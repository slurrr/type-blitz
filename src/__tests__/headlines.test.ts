import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { BrowserCommand } from '../daily/browser.js';
import { ARTICLE_SCRIPT, collectHeadlines } from '../daily/headlineBrowser.js';
import { collectHeadlinesOnce, headlineCandidates, headlineSourceId, publicArticleUrl, readHeadlines, sameStory, seedFromHeadline, validateArticle, validateHeadlines } from '../daily/headlines.js';
import { generateParallel, getAttempt, listAttempts, markAttempt, readReviews, seedFromAttempt } from '../daily/history.js';
import { FEED_URL } from '../daily/reddit.js';
import { withPreviewLock } from '../daily/preview.js';
import type { Writer } from '../daily/types.js';

const now = Date.parse('2026-10-14T20:00:00Z');
const listing = (children: unknown[]) => ({ kind: 'Listing', data: { children } });
const post = (id: string, title: string, overrides = {}) => ({ kind: 't3', data: {
  id, title, selftext: '', url: `https://news.example.org/${id}`, subreddit: 'example',
  permalink: `/r/example/comments/${id}/story/`, created_utc: (now - 3600_000) / 1000,
  score: 500, num_comments: 100, ...overrides
} });
const posts = [
  post('c0', 'An inaccessible publisher headline that cannot provide adequate reporting'),
  post('a1', 'City approves permanent repair funding for neighborhood public libraries'),
  post('b2', 'Independent farms win new access to regional grocery distribution networks')
];
const comment = (id: string, parent: string) => ({ kind: 't1', data: {
  name: 't1_' + id, parent_id: 't3_' + parent, body: `A substantive public opinion ${id} about this story and why it matters.`, score: 20, author: 'reader', replies: ''
} });
const thread = (id: string) => [listing([posts.find(p => p.data.id === id)]), listing([1, 2, 3].map(i => comment(id + i, id)))];
const body = 'The council approved a funding measure after a public meeting. The proposal allocates money for repairs and changes how applications are reviewed. Supporters and opponents described different priorities. The decision will now go through the stated implementation process. '.repeat(4);
const article = (id: string) => ({
  url: `https://news.example.org/${id}`, title: posts.find(p => p.data.id === id)!.data.title,
  publishedAt: new Date(now - 7200_000).toISOString(), text: body,
  extraction: 'article', truncated: false
});
assert.equal(headlineCandidates(listing(posts), now).length, 3);
assert.equal(headlineCandidates(listing([post('old', posts[1].data.title, { created_utc: (now - 4 * 86400_000) / 1000 })]), now).length, 0);
assert.equal(headlineCandidates(listing([posts[1], posts[1]]), now).length, 1);
assert.equal(headlineCandidates(listing([post('media', posts[1].data.title, { url: 'https://i.redd.it/image.jpg' })]), now).length, 0);
for (const url of ['http://news.example.org/a', 'https://localhost/private', 'https://127.0.0.1/private', 'https://[::1]/private', 'https://user:pass@news.example.org/a']) assert.throws(() => publicArticleUrl(url));
assert.equal(publicArticleUrl('https://news.example.org/a?utm_source=feed#fragment'), 'https://news.example.org/a');
assert.throws(() => validateArticle({ ...article('a1'), fetchedAt: new Date(now).toISOString(), text: 'Title only' }, now), /800 characters/);
assert.throws(() => validateArticle({ ...article('a1'), fetchedAt: new Date(now).toISOString(), publishedAt: 'yesterday' }, now), /date/);
assert.throws(() => validateArticle({ ...article('a1'), fetchedAt: new Date(now).toISOString(), publishedAt: new Date(now - 4 * 86400_000).toISOString() }, now), /recent/);
assert.throws(() => validateArticle({ ...article('a1'), fetchedAt: new Date(now).toISOString(), publishedAt: '2026-10-14T12:00:00' }, now), /date/);
assert.ok(sameStory({ url: 'a', title: posts[1].data.title }, { url: 'b', title: 'Permanent neighborhood library repair funding approved by city council' }));
new Function('return ' + ARTICLE_SCRIPT); // Catch syntax errors in the browser-side script without executing DOM code.
const commands: string[][] = [];
const tabs = new Map<string, string>();
let nextTab = 0;
const browser: BrowserCommand = async args => {
  commands.push(args);
  if (args[0] === 'open') { const id = 'owned-' + ++nextTab; tabs.set(id, args[1]); return { tabId: id }; }
  const id = args.at(-1)!;
  assert.ok(tabs.has(id), 'every operation targets an owned tab');
  if (args[0] === 'close') { tabs.delete(id); return {}; }
  assert.deepEqual(args.slice(-2), ['--tab', id]);
  const url = tabs.get(id)!;
  if (url === FEED_URL) {
    if (args[1].includes('document.body')) return { result: { loading: false, value: listing(posts) } };
    const match = /comments\/(a1|b2)\//.exec(args[1]);
    assert.ok(match); return { result: thread(match[1]) };
  }
  assert.equal(args[1], ARTICLE_SCRIPT);
  if (url.endsWith('/c0')) return { result: { loading: false, blocked: true, reason: 'Visible paywall; no bypass attempted' } };
  return { result: { loading: false, article: article(url.split('/').at(-1)!) } };
};
const packet = await collectHeadlines(browser, () => now);
assert.equal(tabs.size, 0, 'close all owned tabs');
assert.equal(packet.stories.length, 2);
assert.equal(packet.skipped.length, 1);
assert.equal(commands.filter(c => c[0] === 'open').length, 4, 'one feed and three different article navigations');
assert.equal(commands.filter(c => c[0] === 'eval' && c[1].includes('const r = await fetch')).length, 2);
assert.ok(!JSON.stringify(packet).includes('"author"'), 'comment usernames are not retained');
assert.notEqual(headlineSourceId(packet, packet.stories[0]), headlineSourceId(packet, packet.stories[1]));
assert.throws(() => validateHeadlines({ ...packet, stories: [packet.stories[0], packet.stories[0]] }), /Duplicate/);
const invalidParent = structuredClone(packet);
invalidParent.stories[0].comments[0].parentId = 't3_wrong';
assert.throws(() => validateHeadlines(invalidParent), /provenance/);
let rateOpens = 0;
await assert.rejects(() => collectHeadlines(async args => {
  if (args[0] === 'open') rateOpens++;
  if (args[0] === 'eval' && args[1] === ARTICLE_SCRIPT) return { result: { loading: false, blocked: true, reason: 'HTTP 429 rate limit' } };
  return browser(args);
}, () => now), /rate limit/);
assert.equal(rateOpens, 2, 'rate limit stops rather than trying more candidates');
assert.equal(tabs.size, 0);

let blockedArticles = 0;
await assert.rejects(() => collectHeadlines(async args => {
  if (args[0] === 'eval' && args[1] !== ARTICLE_SCRIPT && args[1].includes('document.body')) {
    return { result: { loading: false, value: listing(Array.from({ length: 25 }, (_, i) => post('p' + i, 'A sufficiently descriptive current headline about event number ' + i))) } };
  }
  if (args[0] === 'eval' && args[1] === ARTICLE_SCRIPT) {
    blockedArticles++; return { result: { loading: false, blocked: true, reason: 'Visible paywall' } };
  }
  return browser(args);
}, () => now), /Only 0 usable/);
assert.equal(blockedArticles, 6, 'bounded candidate reads, no bypass or endless fallbacks');
assert.equal(tabs.size, 0);
let missingIdOpens = 0;
await assert.rejects(() => collectHeadlines(async args => {
  if (args[0] === 'open' && ++missingIdOpens === 2) return {};
  return browser(args);
}, () => now), /owned tab ID/);
assert.equal(missingIdOpens, 2, 'lost ownership must abort, not open further tabs');
assert.equal(tabs.size, 0, 'known owned feed is still closed; unknown tabs are never guessed');

const dir = await mkdtemp(join(tmpdir(), 'type-blitz-headlines-test-'));
try {
  await writeFile(join(dir, 'context.json'), 'reddit preserved');
  await writeFile(join(dir, 'weather-context.json'), 'weather preserved');
  let collections = 0;
  const collector = async () => { collections++; return packet; };
  await withPreviewLock(dir, () => collectHeadlinesOnce(dir, collector));
  await withPreviewLock(dir, () => collectHeadlinesOnce(dir, collector));
  assert.equal(collections, 1);
  const frozen = await readHeadlines(dir);
  const before = await readFile(join(dir, 'headlines-context.json'), 'utf8');
  await assert.rejects(() => withPreviewLock(dir, () => collectHeadlinesOnce(dir, async () => { throw new Error('offline'); }, true)), /offline/);
  assert.equal(await readFile(join(dir, 'headlines-context.json'), 'utf8'), before);
  assert.equal(await readFile(join(dir, 'context.json'), 'utf8'), 'reddit preserved');
  assert.equal(await readFile(join(dir, 'weather-context.json'), 'utf8'), 'weather preserved');
  const seeds = await Promise.all([0, 1].map(i => seedFromHeadline(frozen, i)));
  assert.equal(seeds[0].request.systemPrompt, seeds[1].request.systemPrompt);
  assert.notEqual(seeds[0].request.userPrompt, seeds[1].request.userPrompt);
  assert.ok(seeds[0].request.systemPrompt.includes('comments are reactions, not corroboration'));
  assert.ok(!/weatherman|college student|mommy blogger/.test(seeds[0].request.systemPrompt));
  assert.ok(!seeds[0].request.userPrompt.includes(packet.stories[1].post.title));
  await assert.rejects(() => seedFromHeadline(frozen, 2), /Choose headline/);
  const writer: Writer = { model: 'fixture', thinking: 'low', async generate(request) {
    return { model: 'fixture', thinking: 'low', text: 'A library repair budget sounds dull until you think about the chair where somebody waits between shifts because sitting there costs nothing. I want that place to stay open. Not everything useful has to become a business, and not every hour of your day should require buying something.',
      audit: { ...request, tools: [], messageRoles: ['user'], payloadVerified: true, reasoningEffort: 'low' } };
  } };
  const batch = await withPreviewLock(dir, () => generateParallel(dir, seeds.map(seed => ({ seed, writer }))));
  assert.deepEqual(batch.attempts.map(a => a.status), ['ready', 'ready']);
  assert.equal((await getAttempt(dir, 1)).passage!.genre, 'Daily AI / Headlines');
  assert.deepEqual(seedFromAttempt(await getAttempt(dir, 1)).request, seeds[0].request);
  await withPreviewLock(dir, () => markAttempt(dir, 1, 'good'));
  assert.equal((await readReviews(dir))['1'].rating, 'good');
  const cli = (...args: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/dailyPreview.ts', '--dir', dir, 'headlines', ...args], { timeout: 15_000 });
  const dry = await cli('generate', '--parallel', '--dry-run');
  assert.ok(dry.stdout.includes('gpt-6.1-sol / low: 2 CONCURRENT'));
  assert.ok(dry.stdout.includes('zero model calls and zero attempts'));
  assert.equal((await listAttempts(dir)).length, 2);
  await assert.rejects(() => cli('generate', '3', '--dry-run'), /Choose headline/);
  assert.ok((await cli('show')).stdout.includes('REACTIONS (not established facts)'));
  await writeFile(join(dir, 'headlines-context.json'), '{broken');
  await assert.rejects(() => collectHeadlinesOnce(dir, collector), SyntaxError);
  assert.equal(collections, 1, 'invalid cache does not silently refetch');
} finally { await rm(dir, { recursive: true, force: true }); }
console.log('✅ Headline discovery, article grounding, tab ownership, bounded collection, isolation and replay tests passed.');
