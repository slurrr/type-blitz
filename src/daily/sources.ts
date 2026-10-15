import { localTimestamp } from './time.js';
import { browserCommand, readFeedDocument, type BrowserCommand } from './browser.js';
import { collectHeadlines } from './headlineBrowser.js';
import { HEADLINE_FEED_URL, HEADLINE_POST_LIMIT, sameCoverage, type HeadlinesPacket } from './headlines.js';
import type { CollectionObserver } from './collectionReport.js';
import { eligiblePosts, extractComments, makePacket } from './reddit.js';
import type { SourcePacket } from './types.js';
import { collectWeather, type WeatherPacket } from './weather.js';

export interface DailySources {
  weather: WeatherPacket;
  headlines: HeadlinesPacket;
  buzz: [SourcePacket, SourcePacket];
}

/** One shared discovery feed; two article discussions and two distinct buzz discussions. */
export async function collectDailyReddit(
  command: BrowserCommand = browserCommand, now = () => Date.now(),
  progress: (message: string) => void = () => {}, observe: CollectionObserver = () => {}
): Promise<Pick<DailySources, 'headlines' | 'buzz'>> {
  observe({ stage: 'feed', status: 'start', url: HEADLINE_FEED_URL });
  const opened = await command(['open', HEADLINE_FEED_URL]);
  if (typeof opened.tabId !== 'string' && typeof opened.tabId !== 'number') throw new Error('Browser did not return an owned tab ID.');
  const tab = String(opened.tabId);
  try {
    const listing = await readFeedDocument(command, tab, HEADLINE_FEED_URL);
    progress('Reading two headline articles and their discussions');
    const headlines = await collectHeadlines(command, now, { tab, listing }, observe);
    const selected = headlines.stories.flatMap(s => [s.post, s.article]);
    const posts = eligiblePosts(listing, now(), HEADLINE_POST_LIMIT).filter(post =>
      !headlines.stories.some(s => s.post.id === post.id) && !selected.some(s => sameCoverage(s, post)));
    const buzz: SourcePacket[] = [];
    progress('Reading two other Reddit buzz discussions');
    for (const post of posts) {
      if (buzz.some(b => b.post.id === post.id || sameCoverage(b.post, post))) continue;
      const path = new URL(post.permalink).pathname.replace(/\/$/, '') + '.json?sort=top&limit=20&depth=2&raw_json=1';
      const script = `(async () => {
        const r = await fetch(${JSON.stringify(path)}, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('Reddit HTTP ' + r.status + '; no retry');
        return await r.json();
      })()`;
      const thread = await command(['eval', script, '--tab', tab]);
      const packet = makePacket(post, extractComments(thread.result, post.id), localTimestamp(new Date(now())));
      packet.feed = HEADLINE_FEED_URL;
      packet.selection = `First two distinct eligible popular/hot topics excluding the selected headlines; same ${HEADLINE_POST_LIMIT}-post discovery snapshot. Two bounded discussion requests; no subreddit allowlist.`;
      observe({ stage: 'buzz', status: 'ready', url: post.permalink, title: post.title,
        details: { comments: packet.comments.length } });
      buzz.push(packet);
      if (buzz.length === 2) break;
    }
    if (buzz.length !== 2) throw new Error('Fewer than two distinct readable buzz topics in the discovery snapshot. No extra requests.');
    return { headlines, buzz: [buzz[0], buzz[1]] };
  } finally { await command(['close', '--tab', tab]); }
}

/** Cancellation still permits owned-tab cleanup. No new network work after cancellation. */
export async function collectDailySources(
  signal: AbortSignal, progress: (message: string) => void, observe: CollectionObserver = () => {}
): Promise<DailySources> {
  const command: BrowserCommand = async args => {
    if (args[0] !== 'close') signal.throwIfAborted();
    return browserCommand(args);
  };
  progress('Collecting Helena forecast and Reddit popular/hot');
  const weatherWork = async () => {
    observe({ stage: 'weather', status: 'start' });
    try {
      const packet = await collectWeather((url, options) => fetch(url, { ...options, signal: AbortSignal.any([signal, options.signal!]) }));
      observe({ stage: 'weather', status: 'ready', url: packet.forecast?.url,
        details: { issuedAt: packet.forecast?.issuedAt, periods: packet.forecast?.periods.length } });
      return packet;
    } catch (error) {
      observe({ stage: 'weather', status: 'error', reason: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  };
  // Settle both branches before releasing the generation lock, even if one fails.
  const results = await Promise.allSettled([
    weatherWork(),
    collectDailyReddit(command, () => Date.now(), progress, observe)
  ] as const);
  signal.throwIfAborted();
  const [weather, reddit] = results;
  if (weather.status === 'rejected') throw weather.reason;
  if (reddit.status === 'rejected') throw reddit.reason;
  return { weather: weather.value, ...reddit.value };
}
