import { browserCommand, readFeedDocument, type BrowserCommand } from './browser.js';
import { collectHeadlines } from './headlineBrowser.js';
import { sameStory, type HeadlinesPacket } from './headlines.js';
import { eligiblePosts, extractComments, FEED_URL, makePacket } from './reddit.js';
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
  progress: (message: string) => void = () => {}
): Promise<Pick<DailySources, 'headlines' | 'buzz'>> {
  const opened = await command(['open', FEED_URL]);
  if (typeof opened.tabId !== 'string' && typeof opened.tabId !== 'number') throw new Error('Browser did not return an owned tab ID.');
  const tab = String(opened.tabId);
  try {
    const listing = await readFeedDocument(command, tab);
    progress('Reading two headline articles and their discussions');
    const headlines = await collectHeadlines(command, now, { tab, listing });
    const selected = headlines.stories.flatMap(s => [s.post, s.article]);
    const posts = eligiblePosts(listing, now()).filter(post =>
      !headlines.stories.some(s => s.post.id === post.id) && !selected.some(s => sameStory(s, post)));
    const buzz: SourcePacket[] = [];
    progress('Reading two other Reddit buzz discussions');
    for (const post of posts) {
      if (buzz.some(b => b.post.id === post.id || sameStory(b.post, post))) continue;
      const path = new URL(post.permalink).pathname.replace(/\/$/, '') + '.json?sort=top&limit=20&depth=2&raw_json=1';
      const script = `(async () => {
        const r = await fetch(${JSON.stringify(path)}, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('Reddit HTTP ' + r.status + '; no retry');
        return await r.json();
      })()`;
      const thread = await command(['eval', script, '--tab', tab]);
      const packet = makePacket(post, extractComments(thread.result, post.id), new Date(now()).toISOString());
      packet.selection = 'First two distinct eligible popular/hot topics excluding the selected headlines; same 25-post discovery snapshot. Two bounded discussion requests; no subreddit allowlist.';
      buzz.push(packet);
      if (buzz.length === 2) break;
    }
    if (buzz.length !== 2) throw new Error('Fewer than two distinct readable buzz topics in the discovery snapshot. No extra requests.');
    return { headlines, buzz: [buzz[0], buzz[1]] };
  } finally { await command(['close', '--tab', tab]); }
}

/** Cancellation still permits owned-tab cleanup. No new network work after cancellation. */
export async function collectDailySources(
  signal: AbortSignal, progress: (message: string) => void
): Promise<DailySources> {
  const command: BrowserCommand = async args => {
    if (args[0] !== 'close') signal.throwIfAborted();
    return browserCommand(args);
  };
  progress('Collecting Helena forecast and Reddit popular/hot');
  // Settle both branches before releasing the generation lock, even if one fails.
  const results = await Promise.allSettled([
    collectWeather((url, options) => fetch(url, { ...options, signal: AbortSignal.any([signal, options.signal!]) })),
    collectDailyReddit(command, () => Date.now(), progress)
  ] as const);
  signal.throwIfAborted();
  const [weather, reddit] = results;
  if (weather.status === 'rejected') throw weather.reason;
  if (reddit.status === 'rejected') throw reddit.reason;
  return { weather: weather.value, ...reddit.value };
}
