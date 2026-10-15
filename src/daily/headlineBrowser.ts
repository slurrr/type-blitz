import { localTimestamp } from './time.js';
import { setTimeout as delay } from 'node:timers/promises';
import { browserCommand, readFeedDocument, type BrowserCommand } from './browser.js';
import { HEADLINE_ARTICLE_LIMIT, HEADLINE_FEED_URL, HEADLINE_POST_LIMIT, headlineCandidates, object, publicArticleUrl, sameCoverage, validateArticle, validateHeadlines, type HeadlineArticle, type HeadlinesPacket, type HeadlineStory } from './headlines.js';
import type { CollectionObserver } from './collectionReport.js';
import { cleanText, extractComments } from './reddit.js';

function ownedTab(opened: Record<string, unknown>): string {
  if (typeof opened.tabId !== 'string' && typeof opened.tabId !== 'number') throw new Error('Browser did not return an owned tab ID.');
  return String(opened.tabId);
}
export const ARTICLE_SCRIPT = `(() => {
  const title = document.title || '';
  const body = document.body?.innerText || '';
  const diagnostics = { url: location.origin + location.pathname, title: title.slice(0, 160),
    readyState: document.readyState, bodyCharacters: body.length };
  const loading = reason => ({ loading: true, reason, diagnostics });
  const blocked = reason => ({ loading: false, blocked: true, reason, diagnostics });
  if (location.href === 'about:blank' || !document.body) return loading('Navigation has not committed');
  // Do not wait for ads/analytics to finish loading when visible reporting is already available.
  if (/just a moment|access denied|verify you are human|too many requests|rate limit/i.test(title + body.slice(0, 1500))) {
    return blocked(title + ': ' + body.slice(0, 200));
  }
  const visible = e => !!([...e.getClientRects()].some(r => r.width > 0 && r.height > 0) && getComputedStyle(e).visibility !== 'hidden');
  if ([...document.querySelectorAll('#sec-if-cpt-container, #challenge-running, #challenge-stage, #datadome-captcha, iframe[src*="captcha"], iframe[src*="challenges.cloudflare.com"]')].some(visible)) {
    return blocked('Publisher security/CAPTCHA challenge; no bypass attempted');
  }
  if ([...document.querySelectorAll('#paywall, [data-testid="paywall"], .paywall')].some(visible)) {
    return blocked('Visible paywall; no bypass attempted');
  }
  const paragraphText = e => [...e.querySelectorAll('p')]
    .filter(p => visible(p) && !p.closest('nav, aside, footer, [aria-hidden="true"], [hidden]'))
    .map(p => p.innerText?.trim() || '').filter(t => t.length >= 25).join('\\n\\n');
  const byLength = (a,b) => paragraphText(b).length - paragraphText(a).length;
  const roots = [...document.querySelectorAll('article, [itemprop="articleBody"]')].sort(byLength)
    .concat([...document.querySelectorAll('main, [role="main"]')].sort(byLength));
  const root = roots.find(e => paragraphText(e).length >= 800) || roots[0];
  if (!root) return loading('No visible article/main reporting container');
  const raw = paragraphText(root);
  diagnostics.reportingCharacters = raw.length;
  if (raw.length < 800) return loading('Fewer than 800 characters of visible reporting');
  let publishedAt = document.querySelector('meta[property="article:published_time"], meta[name="pubdate"], meta[itemprop="datePublished"]')?.getAttribute('content');
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (!publishedAt && types.some(t => /(?:^|\\/)(?:NewsArticle|Article|ReportageNewsArticle|BlogPosting)$/.test(t))) publishedAt = value.datePublished;
    if (value['@graph']) visit(value['@graph']);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent)); } catch {}
  }
  if (!publishedAt) publishedAt = root.querySelector('time[datetime]')?.getAttribute('datetime');
  if (!publishedAt) return loading('Missing publication date metadata');
  return { loading: false, diagnostics, article: {
    url: location.href, title: root.querySelector('h1')?.innerText || document.querySelector('h1')?.innerText || document.querySelector('meta[property="og:title"]')?.getAttribute('content') || title,
    publishedAt, text: raw.slice(0, 14000), truncated: raw.length > 14000,
    extraction: root.getAttribute('itemprop') === 'articleBody' ? 'articleBody' : root.tagName.toLowerCase() === 'article' ? 'article' : 'main'
  } };
})()`;

export class ArticleReadError extends Error {
  constructor(message: string, readonly diagnostics?: Record<string, unknown>) { super(message); }
}

export async function readArticle(
  command: BrowserCommand, url: string, now = () => Date.now(),
  timing: { timeoutMs?: number; pollMs?: number; stableMs?: number } = {}
): Promise<HeadlineArticle> {
  url = publicArticleUrl(url);
  const tab = ownedTab(await command(['open', url]));
  let diagnostics: Record<string, unknown> | undefined;
  let reason = 'Navigation still loading';
  try {
    const timeout = timing.timeoutMs ?? 15_000;
    const deadline = Date.now() + timeout;
    let fingerprint = '', stableSince = 0;
    while (Date.now() < deadline) {
      try {
        const response = await command(['eval', ARTICLE_SCRIPT, '--tab', tab]);
        const result = object(response.result);
        if (result.diagnostics) diagnostics = object(result.diagnostics);
        if (typeof result.reason === 'string') reason = cleanText(result.reason, 300);
        if (result.loading === false) {
          if (result.blocked) throw new Error('Article unavailable: ' + reason);
          const article = validateArticle({ ...object(result.article), fetchedAt: localTimestamp(new Date(now())) }, now());
          const signature = JSON.stringify({ ...article, fetchedAt: undefined });
          if (signature !== fingerprint) { fingerprint = signature; stableSince = Date.now(); }
          if (Date.now() - stableSince >= (timing.stableMs ?? 1000)) return article;
          reason = 'Visible reporting has not yet settled';
        } else if (result.loading === true) {
          fingerprint = ''; // Hydration/redirect can temporarily remove the content.
        } else throw new Error('Unexpected article DOM result.');
      } catch (error) {
        if (!(error instanceof Error) || !/Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
      }
      await delay(timing.pollMs ?? 250); // Only local DOM reads: never reload or bypass a publisher.
    }
    throw new Error(`Article extraction timed out after ${timeout / 1000}s: ${reason}. No reload or retry.`);
  } catch (error) {
    throw new ArticleReadError(error instanceof Error ? error.message : String(error), diagnostics);
  } finally {
    try { await command(['close', '--tab', tab]); }
    catch (error) { throw new Error(`Could not close owned article tab ${tab}; stop and inspect it.`, { cause: error }); }
  }
}

/** One 100-post discovery snapshot; at most ten article navigations and two discussion requests. */
export async function collectHeadlines(
  command: BrowserCommand = browserCommand, now = () => Date.now(),
  sharedFeed?: { tab: string; listing: unknown }, // Caller owns and closes this tab.
  observe: CollectionObserver = () => {}
): Promise<HeadlinesPacket> {
  const feedTab = sharedFeed?.tab ?? ownedTab(await command(['open', HEADLINE_FEED_URL]));
  const stories: HeadlineStory[] = [], skipped: HeadlinesPacket['skipped'] = [];
  try {
    const eligible = headlineCandidates(sharedFeed ? sharedFeed.listing : await readFeedDocument(command, feedTab, HEADLINE_FEED_URL), now());
    const candidates = eligible.slice(0, HEADLINE_ARTICLE_LIMIT);
    observe({ stage: 'feed', status: 'ready', url: HEADLINE_FEED_URL,
      details: { postLimit: HEADLINE_POST_LIMIT, eligible: eligible.length, candidateBudget: HEADLINE_ARTICLE_LIMIT,
        candidates: candidates.map(p => ({ id: p.id, title: p.title, url: p.url })) } });
    for (const post of candidates) {
      const skip = (reason: string, details?: Record<string, unknown>) => {
        skipped.push({ url: post.url, reason });
        observe({ stage: 'article', status: 'skip', url: post.url, title: post.title, reason, details });
      };
      if (stories.some(s => sameCoverage(s.post, post))) {
        skip('Duplicate URL or strongly overlapping discovery headline/URL slug.');
        continue;
      }
      let article: HeadlineArticle;
      observe({ stage: 'article', status: 'start', url: post.url, title: post.title });
      const start = Date.now();
      try {
        article = await readArticle(command, post.url, now);
      } catch (error) {
        const reason = cleanText(error instanceof Error ? error.message : String(error), 1200);
        skip(reason, { elapsedMs: Date.now() - start, ...(error instanceof ArticleReadError ? error.diagnostics : {}) });
        if (/owned tab ID|close owned article tab/i.test(reason)) throw error;
        if (/\b429\b|too many requests|rate limit/i.test(reason)) throw new Error('Collection stopped on rate limit: ' + reason);
        continue; // A different candidate, never a reload or bypass of the blocked publisher.
      }
      if (stories.some(s => sameCoverage(s.article, article))) {
        skip('Duplicate URL or strongly overlapping article headline/URL slug.');
        continue;
      }
      observe({ stage: 'article', status: 'ready', url: article.url, title: article.title,
        details: { elapsedMs: Date.now() - start, characters: article.text.length, publishedAt: article.publishedAt, extraction: article.extraction } });
      const path = new URL(post.permalink).pathname.replace(/\/$/, '') + '.json?sort=top&limit=20&depth=2&raw_json=1';
      const script = `(async () => {
        const r = await fetch(${JSON.stringify(path)}, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('Reddit HTTP ' + r.status + '; no retry');
        return await r.json();
      })()`;
      const thread = await command(['eval', script, '--tab', feedTab]);
      // Failure stops, rather than issuing unbounded extra account-backed discussion requests.
      stories.push({ post, article, comments: extractComments(thread.result, post.id) });
      if (stories.length === 2) break;
    }
    if (stories.length !== 2) throw new Error(`Only ${stories.length}/2 usable headlines from ${candidates.length} candidates (budget ${HEADLINE_ARTICLE_LIMIT}, first ${HEADLINE_POST_LIMIT} posts). No packet replaced. ${skipped.map(s => `${new URL(s.url).hostname}: ${s.reason}`).join('; ')}`);
    const packet = validateHeadlines({
      version: 1, kind: 'headlines', feed: HEADLINE_FEED_URL, fetchedAt: localTimestamp(new Date(now())), stories, skipped,
      selection: `First two eligible external articles from the first ${HEADLINE_POST_LIMIT} popular/hot posts; at most ${HEADLINE_ARTICLE_LIMIT} candidate reads. Posts: within 72 hours, 20+ comments. Articles: publication date within 72 hours, 800+ characters of visible reporting. Exact URL/title-overlap deduplication, not an editorial or ideological choice.`,
      limitations: [
        'Discovery rank is one public Reddit feed viewed in a real browser; not universal/global attention or guaranteed account/region independent.',
        'Linked publisher reporting is a single source, not independent corroboration. DOM extraction may omit context or include related text; inspect before generation.',
        'Top-sorted comments are a small reaction sample, not established facts or public consensus. Comment author fields are not retained; inline handles may remain in quoted discussion.',
        'URL/title overlap is only a duplicate heuristic, not proof of distinct events. Readability and publication metadata affect which stories survive.'
      ]
    });
    observe({ stage: 'headlines', status: 'ready', details: { stories: stories.map(s => ({ url: s.article.url, title: s.article.title })) } });
    return packet;
  } catch (error) {
    observe({ stage: 'headlines', status: 'error', reason: cleanText(error instanceof Error ? error.message : String(error), 2000) });
    throw error;
  } finally { if (!sharedFeed) await command(['close', '--tab', feedTab]); }
}
