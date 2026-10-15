import assert from 'node:assert/strict';
import chalk from 'chalk';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ARTICLE_SCRIPT, ArticleReadError, readArticle } from '../daily/headlineBrowser.js';
import { HEADLINE_FEED_URL, headlineCandidates, sameCoverage, sameStory, validateArticle } from '../daily/headlines.js';
import { checkDailyCollection } from '../daily/collectionCheck.js';
import { traceCollection, collectionReportPath } from '../daily/collectionReport.js';
import { DailyClient } from '../daily/client.js';
import { dailyDay } from '../daily/session.js';
import { eligiblePosts } from '../daily/reddit.js';
import { renderMenuView } from '../renderer/statsDisplay.js';
import { Palette } from '../renderer/ansi.js';
import { stripAnsi } from '../renderer/displayWidth.js';

const now = Date.parse('2026-10-15T15:00:00Z');
const publishedAt = '2026-10-15T10:00:00Z';
const body = 'The public library will receive funding for repairs and expanded opening hours after the council approved a new budget measure. '.repeat(10);
const url = 'https://news.example.org/library-budget';
function dom(options: { kind?: string; ready?: string; missing?: boolean; challenge?: boolean; paywall?: boolean; jsonDate?: boolean; blank?: boolean } = {}) {
  const visible = { getClientRects: () => [{ width: 100, height: 100 }] };
  const paragraph = { ...visible, innerText: body, closest: () => null };
  const hidden = { ...paragraph, innerText: 'HIDDEN SUBSCRIBER CONTENT '.repeat(100), getClientRects: () => [] };
  const sidebar = { ...paragraph, innerText: 'UNRELATED NAVIGATION '.repeat(100), closest: () => ({}) };
  const kind = options.kind ?? 'article';
  const root = { ...visible, tagName: kind === 'article' ? 'ARTICLE' : 'DIV',
    getAttribute: (name: string) => name === 'itemprop' && kind === 'articleBody' ? 'articleBody' : null,
    querySelectorAll: () => [paragraph, hidden, sidebar],
    querySelector: (selector: string) => selector === 'h1' ? { innerText: 'Library budget approved' } : null };
  return runInNewContext(ARTICLE_SCRIPT, {
    location: { href: options.blank ? 'about:blank' : url, origin: 'https://news.example.org', pathname: '/library-budget' },
    getComputedStyle: () => ({ visibility: 'visible' }),
    document: { title: 'Library budget', readyState: options.ready ?? 'interactive', body: { innerText: body },
      querySelector: (selector: string) => selector.startsWith('meta[property="article:published_time"]') && !options.jsonDate
        ? { getAttribute: () => publishedAt } : null,
      querySelectorAll: (selector: string) => {
        if (selector.startsWith('#sec-if-cpt')) return options.challenge ? [visible] : [];
        if (selector.startsWith('#paywall')) return options.paywall ? [visible] : [];
        if (selector.startsWith('script[')) return options.jsonDate ? [{ textContent: JSON.stringify({ '@graph': [
          { '@type': 'https://schema.org/NewsArticle', datePublished: publishedAt }
        ] }) }] : [];
        if (options.missing) return [];
        if (selector.startsWith('article,')) return ['article', 'articleBody'].includes(kind) ? [root] : [];
        if (selector.startsWith('main,')) return kind === 'main' ? [root] : [];
        throw new Error('Unexpected selector ' + selector);
      }
    }
  });
}
for (const kind of ['article', 'main', 'articleBody']) {
  const result = dom({ kind });
  assert.equal(result.loading, false, 'interactive DOM with reporting need not wait for ads/load event');
  assert.equal(result.article.text, body.trim());
  assert.equal(result.article.extraction, kind);
  assert.equal(validateArticle({ ...result.article, fetchedAt: new Date(now).toISOString() }, now).text, body.trim());
}
assert.equal(dom({ jsonDate: true }).article.publishedAt, publishedAt);
assert.equal(dom({ missing: true, ready: 'complete' }).loading, true, 'complete document can still be hydrating');
assert.match(dom({ missing: true }).reason, /container/);
assert.equal(dom({ blank: true }).loading, true);
assert.equal(dom({ challenge: true }).blocked, true);
assert.match(dom({ challenge: true }).reason, /security\/CAPTCHA/);
assert.equal(dom({ paywall: true }).blocked, true, 'never extract even visible reporting through a detected paywall');

const article = dom().article;
let closed = 0, evaluations = 0;
const hydrated = await readArticle(async args => {
  if (args[0] === 'open') return { tabId: 'owned' };
  assert.equal(args.at(-1), 'owned');
  if (args[0] === 'close') { closed++; return {}; }
  assert.equal(args[0], 'eval', 'no navigation reloads or HTTP retries');
  evaluations++;
  return evaluations === 1 ? { result: { loading: true, reason: 'Hydrating' } }
    : { result: { loading: false, article: { ...article, text: evaluations === 2 ? body : body + 'Final reporting paragraph.' } } };
}, url, () => now, { timeoutMs: 100, pollMs: 1, stableMs: 5 });
assert.ok(evaluations >= 4, 'first valid partial article must not be accepted immediately');
assert.ok(hydrated.text.endsWith('Final reporting paragraph.'));
assert.equal(closed, 1);
await assert.rejects(() => readArticle(async args => {
  if (args[0] === 'open') return { tabId: 'owned' };
  if (args[0] === 'close') { closed++; return {}; }
  return { result: { loading: true, reason: 'No visible article/main reporting container', diagnostics: { url, title: 'Blank shell', readyState: 'complete' } } };
}, url, () => now, { timeoutMs: 5, pollMs: 1 }), error => {
  assert.ok(error instanceof ArticleReadError);
  assert.match(error.message, /timed out.*container/);
  assert.equal(error.diagnostics?.title, 'Blank shell');
  return true;
});
assert.equal(closed, 2, 'timeout closes its owned tab');
await assert.rejects(() => readArticle(async args => {
  if (args[0] === 'open') return { tabId: 'owned' };
  if (args[0] === 'close') { closed++; return {}; }
  return { result: { loading: false, blocked: true, reason: 'Publisher security/CAPTCHA challenge' } };
}, url, () => now), /security\/CAPTCHA/);
assert.equal(closed, 3);

const post = (id: string, overrides = {}) => ({ kind: 't3', data: {
  id, title: 'A sufficiently descriptive headline about important local public library funding and repairs', selftext: '',
  url: 'https://news.example.org/' + id, subreddit: 'example', permalink: `/r/example/comments/${id}/story/`,
  created_utc: now / 1000 - 3600, num_comments: 100, score: 100, ...overrides
} });
const filler = Array.from({ length: 25 }, (_, i) => post('m' + i, { is_gallery: true, url: 'https://i.redd.it/photo.png' }));
const listing = { kind: 'Listing', data: { children: [...filler, post('a'), post('b')] } };
assert.deepEqual(headlineCandidates(listing, now).map(p => p.id), ['a', 'b']);
assert.deepEqual(eligiblePosts(listing, now), [], 'original buzz preview keeps its 25-post boundary');
assert.deepEqual(eligiblePosts(listing, now, 100).map(p => p.id), ['a', 'b']);
assert.equal(headlineCandidates({ kind: 'Listing', data: { children: [...Array(100).fill(filler[0]), post('outside')] } }, now).length, 0);
const short = { title: 'Zelensky turns on Trump', url: 'https://news.example.org/zelensky-defies-trump-ukraine-strike-russian-oil-refineries/' };
const long = { title: 'Zelenskyy Says Ukraine Is Done Holding Back on Russian Oil Refineries', url: 'https://other.example.org/zelenskyy-says-ukraine-is-done-holding-back-on-russian-oil-refineries-23454' };
assert.equal(sameStory(short, long), false, 'historical title-only validation stays unchanged');
assert.equal(sameCoverage(short, long), true, 'descriptive URL slugs catch this cross-publisher duplicate');
assert.equal(sameCoverage(short, { title: 'A different story', url: 'https://news.example.org/new-library-budget-approved/' }), false);

const client = new DailyClient('/unused');
assert.equal(client.status, 'WAIT');
client.pack = { version: 2, id: 'fixture', day: dailyDay(), generatedAt: new Date().toISOString(), model: 'fixture', thinking: 'low', entries: [] };
assert.equal(client.status, 'READY');
client.error = 'Refresh failed';
assert.equal(client.status, 'FAIL', 'even a current-day cached pack cannot hide a failed refresh');
client.busy = true; assert.equal(client.status, 'RUN');
client.busy = false; client.error = undefined; client.pack.day = '2000-01-01';
assert.equal(client.status, 'WAIT', 'old cached content is not READY for today');
client.error = 'Collection failed before any writing'; assert.equal(client.status, 'FAIL');
Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });
chalk.level = 3;
for (const status of ['READY', 'FAIL', 'RUN', 'WAIT'] as const) {
  for (const selected of [0, 1]) {
    const lines = renderMenuView(selected, false, status);
    const daily = lines.find(line => line.includes('QUICK PLAY (DAILY GEN AI)'))!;
    assert.match(stripAnsi(daily), new RegExp('DAILY GEN AI\\)\\s+' + status));
    if (status === 'READY') assert.ok(daily.includes(Palette.green(status)));
    if (status === 'FAIL') assert.ok(daily.includes(Palette.errorRedFg(status)));
    assert.ok(!lines.find(line => line.includes('RANDOM CLASSIC'))!.includes(status));
  }
}

const dir = await mkdtemp(join(tmpdir(), 'type-blitz-collection-report-'));
try {
  await writeFile(join(dir, 'state.json'), 'state preserved');
  await writeFile(join(dir, 'current.json'), 'pack preserved');
  const result = await checkDailyCollection(dir, async (_signal, _progress, observe) => {
    observe!({ stage: 'feed', status: 'ready', url: HEADLINE_FEED_URL, details: { eligible: 1 } });
    observe!({ stage: 'article', status: 'skip', url, reason: 'Publisher security challenge' });
    throw new Error('Only one usable headline');
  });
  assert.equal(result.ok, false);
  const report = JSON.parse(await readFile(result.report, 'utf8'));
  assert.equal(report.status, 'error');
  assert.equal(report.events[1].url, url);
  assert.equal(report.events[1].reason, 'Publisher security challenge');
  assert.match(report.error, /Only one usable/);
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), 'state preserved');
  assert.equal(await readFile(join(dir, 'current.json'), 'utf8'), 'pack preserved');
  assert.deepEqual((await readdir(dir)).sort(), ['collection', 'current.json', 'state.json']);
  assert.equal(await traceCollection(dir, 'success', async observe => {
    observe({ stage: 'headlines', status: 'ready' }); return 42;
  }), 42);
  assert.equal(JSON.parse(await readFile(collectionReportPath(dir, 'success'), 'utf8')).status, 'ready');
  await assert.rejects(() => traceCollection(dir, 'success', async () => 1), /EEXIST/, 'reports are immutable');
} finally { await rm(dir, { recursive: true, force: true }); }
console.log('✅ Collection readiness, stable visible extraction, blocks, 100-post bounds, duplicate slugs, reports and honest menu status passed.');
