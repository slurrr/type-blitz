import { setTimeout as delay } from 'node:timers/promises';
import { browserCommand, readFeedDocument, type BrowserCommand } from './browser.js';
import { headlineCandidates, object, publicArticleUrl, sameStory, validateArticle, validateHeadlines, type HeadlineArticle, type HeadlinesPacket, type HeadlineStory } from './headlines.js';
import { cleanText, extractComments, FEED_URL } from './reddit.js';

function ownedTab(opened: Record<string, unknown>): string {
  if (typeof opened.tabId !== 'string' && typeof opened.tabId !== 'number') throw new Error('Browser did not return an owned tab ID.');
  return String(opened.tabId);
}
export const ARTICLE_SCRIPT = `(() => {
  if (location.href === 'about:blank' || document.readyState !== 'complete') return { loading: true };
  const title = document.title || '';
  const body = document.body?.innerText || '';
  if (/just a moment|access denied|verify you are human|too many requests|rate limit/i.test(title + body.slice(0, 1500))) {
    return { loading: false, blocked: true, reason: title + ': ' + body.slice(0, 200) };
  }
  const visible = e => !!(e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  if ([...document.querySelectorAll('#paywall, [data-testid="paywall"], .paywall')].some(visible)) {
    return { loading: false, blocked: true, reason: 'Visible paywall; no bypass attempted' };
  }
  const roots = [...document.querySelectorAll('article')];
  const paragraphText = e => [...e.querySelectorAll('p')].map(p => p.innerText?.trim() || '').filter(t => t.length >= 25).join('\\n\\n');
  const root = roots.sort((a,b) => paragraphText(b).length - paragraphText(a).length)[0] || document.querySelector('main');
  if (!root) return { loading: false, blocked: true, reason: 'No article/main reporting container' };
  const raw = paragraphText(root);
  let publishedAt = document.querySelector('meta[property="article:published_time"], meta[name="pubdate"], meta[itemprop="datePublished"]')?.getAttribute('content');
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (!publishedAt && types.some(t => /^(?:NewsArticle|Article|ReportageNewsArticle)$/.test(t))) publishedAt = value.datePublished;
    if (value['@graph']) visit(value['@graph']);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent)); } catch {}
  }
  if (!publishedAt) publishedAt = root.querySelector('time[datetime]')?.getAttribute('datetime');
  return { loading: false, article: {
    url: location.href, title: root.querySelector('h1')?.innerText || document.querySelector('h1')?.innerText || document.querySelector('meta[property="og:title"]')?.getAttribute('content') || title,
    publishedAt, text: raw.slice(0, 14000), truncated: raw.length > 14000,
    extraction: root.tagName.toLowerCase() === 'article' ? 'article' : 'main'
  } };
})()`;

export async function readArticle(command: BrowserCommand, url: string, now = () => Date.now()): Promise<HeadlineArticle> {
  url = publicArticleUrl(url);
  const tab = ownedTab(await command(['open', url]));
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const response = await command(['eval', ARTICLE_SCRIPT, '--tab', tab]);
        const result = object(response.result);
        if (result.loading === false) {
          if (result.blocked) throw new Error('Article unavailable: ' + cleanText(result.reason, 300));
          return validateArticle({ ...object(result.article), fetchedAt: new Date(now()).toISOString() }, now());
        }
        if (result.loading !== true) throw new Error('Unexpected article DOM result.');
      } catch (error) {
        if (!(error instanceof Error) || !/Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
      }
      await delay(200); // Local DOM readiness only, not reload/network retry.
    }
    throw new Error('Article did not become ready; no reload or retry.');
  } finally {
    try { await command(['close', '--tab', tab]); }
    catch (error) { throw new Error(`Could not close owned article tab ${tab}; stop and inspect it.`, { cause: error }); }
  }
}

/** One discovery navigation; at most six candidate articles and two bounded discussion requests. */
export async function collectHeadlines(
  command: BrowserCommand = browserCommand, now = () => Date.now(),
  sharedFeed?: { tab: string; listing: unknown } // Caller owns and closes this tab.
): Promise<HeadlinesPacket> {
  const feedTab = sharedFeed?.tab ?? ownedTab(await command(['open', FEED_URL]));
  const stories: HeadlineStory[] = [], skipped: HeadlinesPacket['skipped'] = [];
  try {
    const candidates = headlineCandidates(sharedFeed ? sharedFeed.listing : await readFeedDocument(command, feedTab), now()).slice(0, 6);
    for (const post of candidates) {
      if (stories.some(s => sameStory(s.post, post))) {
        skipped.push({ url: post.url, reason: 'Duplicate URL or strongly overlapping discovery headline.' });
        continue;
      }
      let article: HeadlineArticle;
      try {
        article = await readArticle(command, post.url, now);
      } catch (error) {
        const reason = cleanText(error instanceof Error ? error.message : String(error), 1200);
        if (/owned tab ID|close owned article tab/i.test(reason)) throw error;
        if (/429|too many requests|rate limit/i.test(reason)) throw new Error('Collection stopped on rate limit: ' + reason);
        skipped.push({ url: post.url, reason });
        continue; // A different candidate, never a retry or bypass of the blocked publisher.
      }
      if (stories.some(s => sameStory(s.article, article))) {
        skipped.push({ url: post.url, reason: 'Duplicate URL or strongly overlapping article headline.' });
        continue;
      }
      const path = new URL(post.permalink).pathname.replace(/\/$/, '') + '.json?sort=top&limit=20&depth=2&raw_json=1';
      const script = `(async () => {
        const r = await fetch(${JSON.stringify(path)}, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('Reddit HTTP ' + r.status + '; no retry');
        return await r.json();
      })()`;
      const thread = await command(['eval', script, '--tab', feedTab]);
      // Failure here stops, rather than issuing unbounded extra account-backed discussion requests.
      stories.push({ post, article, comments: extractComments(thread.result, post.id) });
      if (stories.length === 2) break;
    }
    if (stories.length !== 2) throw new Error(`Only ${stories.length} usable headline(s) in six candidates. No packet replaced. ${skipped.map(s => s.reason).join('; ')}`);
    return validateHeadlines({
      version: 1, kind: 'headlines', feed: FEED_URL, fetchedAt: new Date(now()).toISOString(), stories, skipped,
      selection: 'First two eligible external articles from the first 25 popular/hot posts; at most six candidate reads. Posts: within 72 hours, 20+ comments. Articles: publication date within 72 hours, 800+ characters in article/main paragraphs. Exact URL/title-overlap deduplication, not an editorial or ideological choice.',
      limitations: [
        'Discovery rank is one public Reddit feed viewed in a real browser; not universal/global attention or guaranteed account/region independent.',
        'Linked publisher reporting is a single source, not independent corroboration. DOM extraction may omit context or include related text; inspect before generation.',
        'Top-sorted comments are a small reaction sample, not established facts or public consensus. Comment author fields are not retained; inline handles may remain in quoted discussion.',
        'URL/title overlap is only a duplicate heuristic, not proof of distinct events. Readability and publication metadata affect which stories survive.'
      ]
    });
  } finally { if (!sharedFeed) await command(['close', '--tab', feedTab]); }
}
