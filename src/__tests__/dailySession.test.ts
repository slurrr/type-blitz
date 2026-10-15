import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DailyClient } from '../daily/client.js';
import { listAttempts } from '../daily/history.js';
import { validateHeadlines } from '../daily/headlines.js';
import { makePiWriter } from '../daily/pi.js';
import { makePacket } from '../daily/reddit.js';
import { collectDailyReddit, type DailySources } from '../daily/sources.js';
import { getRandomPassage, LITERARY_PASSAGES } from '../passages/passages.js';
import { DAILY_MODEL, DAILY_PASSAGE_COUNT, dailyDay, dailySeeds, ensureDaily, readDailyPack, validateDailyPack, type DailyDependencies } from '../daily/session.js';
import { HELENA } from '../daily/weather.js';
import type { Writer } from '../daily/types.js';
import type { BrowserCommand } from '../daily/browser.js';
import { ARTICLE_SCRIPT } from '../daily/headlineBrowser.js';

assert.equal(dailyDay(new Date('2026-10-15T05:59:59Z')), '2026-10-14');
assert.equal(dailyDay(new Date('2026-10-15T06:00:00Z')), '2026-10-15');
assert.equal(dailyDay(new Date('2026-01-15T06:59:59Z')), '2026-01-14');
assert.equal(dailyDay(new Date('2026-01-15T07:00:00Z')), '2026-01-15');
const model = 'openai-codex/' + DAILY_MODEL;
let clock = new Date('2026-10-14T20:00:00Z');
const titles = [
  'City approves permanent repair funding for neighborhood public libraries',
  'Independent farms win new access to regional grocery distribution networks',
  'What childhood habit do you still secretly enjoy even though everyone else seems to have grown out of it?',
  'People are sharing the strange household inventions their grandparents refused to replace for decades'
];
const listing = (children: unknown[]) => ({ kind: 'Listing', data: { children } });
const posts = () => titles.map((title, i) => ({ kind: 't3', data: {
  id: 'p' + i, title, selftext: i >= 2 ? 'A long description of the topic and why people keep discussing this online instead of moving on to something else. '.repeat(2) : '',
  url: i < 2 ? `https://news.example.org/${i}` : `https://www.reddit.com/r/example/comments/p${i}/story/`,
  subreddit: 'example', permalink: `/r/example/comments/p${i}/story/`,
  created_utc: clock.getTime() / 1000 - 3600, score: 500, num_comments: 100
} }));
const comments = (id: string) => [0, 1, 2].map(i => ({
  id: 't1_' + id + i, parentId: 't3_' + id, text: `An engaged public reaction number ${i} about this particular story and why it matters.`, score: 20, replies: []
}));
const article = (i: number) => ({
  url: `https://news.example.org/${i}`, title: titles[i], publishedAt: new Date(clock.getTime() - 7200_000).toISOString(),
  fetchedAt: clock.toISOString(), text: 'The council debated a measure after a meeting. Several people expressed their different priorities about the proposal and its implementation. '.repeat(8),
  extraction: 'article', truncated: false
});
function sources(): DailySources {
  const raw = posts();
  const mapped = raw.map(({ data: p }) => ({ id: p.id, title: p.title, text: p.selftext, url: p.url,
    subreddit: p.subreddit, permalink: 'https://www.reddit.com' + p.permalink, publishedAt: new Date(p.created_utc * 1000).toISOString(), score: p.score, commentCount: p.num_comments }));
  return {
    headlines: validateHeadlines({ version: 1, kind: 'headlines', feed: 'https://www.reddit.com/r/popular/hot.json?limit=25&raw_json=1',
      fetchedAt: clock.toISOString(), selection: 'Fixture discovery.', limitations: [], skipped: [],
      stories: [0, 1].map(i => ({ post: mapped[i], article: article(i), comments: comments(mapped[i].id) })) }),
    buzz: [2, 3].map(i => makePacket(mapped[i], comments(mapped[i].id), clock.toISOString())) as DailySources['buzz'],
    weather: { version: 1, kind: 'weather', frozenAt: clock.toISOString(), location: HELENA, reports: [],
      forecast: { provider: 'NWS', url: 'https://api.weather.gov/gridpoints/TFX/1,1/forecast', issuedAt: clock.toISOString(),
        periods: Array.from({ length: 10 }, (_, i) => ({ name: 'Period ' + i,
          startTime: new Date(clock.getTime() + i * 43200_000).toISOString(), endTime: new Date(clock.getTime() + (i + 1) * 43200_000).toISOString(),
          isDaytime: i % 2 === 0, temperature: 51, temperatureUnit: 'F', precipitationChance: 10,
          windSpeed: '8 mph', windDirection: 'W', shortForecast: 'Partly sunny', detailedForecast: 'Partly sunny with light wind.' })) } }
  };
}

// Integration of shared-feed collection: no second feed or duplicate headline-as-buzz.
let opened = 0, discussions = 0, failBuzz = false;
const tabs = new Map<string, string>();
const command: BrowserCommand = async args => {
  if (args[0] === 'open') { const id = String(++opened); tabs.set(id, args[1]); return { tabId: id }; }
  const tab = args.at(-1)!;
  assert.ok(tabs.has(tab), 'only owned tabs are used');
  if (args[0] === 'close') { tabs.delete(tab); return {}; }
  assert.deepEqual(args.slice(-2), ['--tab', tab]);
  if (args[1] === ARTICLE_SCRIPT) return { result: { loading: false, article: article(Number(tabs.get(tab)!.split('/').at(-1))) } };
  if (args[1].includes('document.body')) return { result: { loading: false, value: listing([...posts(), posts()[0], posts()[2]]) } };
  discussions++;
  const match = /comments\/(p[0-3])\//.exec(args[1]);
  assert.ok(match);
  const id = match[1];
  if (failBuzz && id === 'p2') throw new Error('Reddit HTTP 429; no retry');
  return { result: [listing([posts().find(p => p.data.id === id)]), listing(comments(id).map(c => ({ kind: 't1', data: {
    name: c.id, parent_id: c.parentId, body: c.text, score: c.score, author: 'reader', replies: ''
  } })))] };
};
const collected = await collectDailyReddit(command, () => clock.getTime());
assert.equal(opened, 3, 'one feed and two articles');
assert.equal(discussions, 4, 'exactly four bounded discussions');
assert.deepEqual(collected.buzz.map(b => b.post.id), ['p2', 'p3']);
assert.equal(tabs.size, 0);
failBuzz = true; discussions = 0;
await assert.rejects(() => collectDailyReddit(command, () => clock.getTime()), /429/);
assert.equal(discussions, 3, 'stop at first rate limit, no alternate discussion');
assert.equal(tabs.size, 0);

const dir = await mkdtemp(join(tmpdir(), 'type-blitz-session-'));
try {
  let collections = 0, setups = 0, calls = 0, inflight = 0, maxInflight = 0, failCall = -1;
  const text = 'hjkl is the beginning of this fixture passage. I want the library to stay open because it is one of the few places where sitting down does not require buying something. That should not be a luxury, and I hate that defending it now sounds like an extravagant demand.';
  const writer: Writer = { model, thinking: 'low', async generate(request) {
    const call = ++calls;
    maxInflight = Math.max(maxInflight, ++inflight);
    await new Promise(resolve => setTimeout(resolve, 10));
    inflight--;
    if (call === failCall) throw new Error('fixture provider failure');
    return { model, thinking: 'low', text, audit: { ...request, tools: [], messageRoles: ['user'], payloadVerified: true, reasoningEffort: 'low' } };
  } };
  const deps: DailyDependencies = {
    now: () => clock,
    collect: async () => { collections++; return sources(); },
    writer: async () => { setups++; return writer; }
  };
  const plan = await dailySeeds(sources());
  assert.equal(DAILY_PASSAGE_COUNT, 16);
  assert.equal(plan.length, DAILY_PASSAGE_COUNT);
  assert.equal(plan.filter(j => j.channel === 'Weather').length, 8);
  assert.equal(plan.filter(j => j.channel === 'Headlines').length, 2);
  assert.equal(plan.filter(j => j.channel === 'Buzz').length, 6);
  for (const mode of ['today', 'extended']) {
    const forecasts = plan.filter(j => j.seed.request.userPrompt.includes('"mode": "' + mode + '"'));
    assert.deepEqual(forecasts.map(j => j.seed.voice), ['forecast-positive', 'forecast-neutral', 'forecast-negative']);
    assert.equal(new Set(forecasts.map(j => j.seed.request.userPrompt)).size, 1, 'all polarities get the same forecast input');
  }
  const reactions = plan.filter(j => j.seed.voice.startsWith('reaction-'));
  assert.deepEqual(reactions.map(j => j.seed.voice), ['reaction-positive', 'reaction-negative']);
  assert.ok(reactions.every(j => !j.seed.request.userPrompt.includes('Helena')));
  const headlines = plan.filter(j => j.channel === 'Headlines');
  assert.ok(headlines.every(j => j.seed.request.systemPrompt.includes('human reaction, not a report')));
  for (const title of titles.slice(2)) {
    const topic = plan.filter(j => j.channel === 'Buzz' && j.seed.request.userPrompt.includes(title));
    assert.deepEqual(topic.map(j => j.seed.voice), ['student', 'blogger', 'satirist']);
    assert.equal(new Set(topic.map(j => j.seed.request.userPrompt)).size, 1, 'every buzz voice gets each topic');
  }
  const originalClock = clock;
  for (const day of ['2026-10-14', '2026-10-15', '2026-10-16']) {
    clock = new Date(day + 'T20:00:00Z');
    assert.deepEqual((await dailySeeds(sources())).map(j => j.seed.voice), plan.map(j => j.seed.voice), 'all voices every day');
  }
  clock = originalClock;

  const first = await ensureDaily(dir, {}, deps);
  assert.equal(first.error, undefined);
  assert.equal(first.pack!.entries.length, DAILY_PASSAGE_COUNT);
  assert.equal(first.pack!.version, 2);
  assert.equal(maxInflight, DAILY_PASSAGE_COUNT, 'model calls run concurrently');
  assert.equal(collections, 1); assert.equal(calls, DAILY_PASSAGE_COUNT); assert.equal(setups, 1);
  const historyBefore = await listAttempts(dir);
  const firstBytes = await readFile(join(dir, 'current.json'), 'utf8');
  const cached = await ensureDaily(dir, {}, deps);
  assert.equal(cached.reused, true); assert.equal(cached.pack!.id, first.pack!.id);
  assert.equal(collections, 1); assert.equal(calls, DAILY_PASSAGE_COUNT); assert.equal(setups, 1);
  const refreshed = await ensureDaily(dir, { force: true }, deps);
  assert.notEqual(refreshed.pack!.id, first.pack!.id);
  assert.equal(collections, 2); assert.equal(calls, 2 * DAILY_PASSAGE_COUNT);
  assert.equal((await readdir(join(dir, 'packs'))).length, 2);
  assert.deepEqual((await listAttempts(dir)).slice(0, DAILY_PASSAGE_COUNT), historyBefore, 'old attempts immutable');
  assert.notEqual(await readFile(join(dir, 'current.json'), 'utf8'), firstBytes);

  const pool = first.pack!.entries.map(e => e.passage);
  const poolBefore = [...pool];
  const random = Math.random;
  try {
    for (let i = 0; i < pool.length; i++) {
      Math.random = () => (i + 0.5) / pool.length;
      assert.equal(getRandomPassage(pool), pool[i], 'every generated passage is reachable by the existing random picker');
    }
    for (const i of [15, 2, 15, 0]) {
      Math.random = () => (i + 0.5) / pool.length;
      assert.equal(getRandomPassage(pool), pool[i], 'no playlist, no repeat suppression');
    }
    Math.random = () => 0.5;
    assert.equal(getRandomPassage(), LITERARY_PASSAGES[Math.floor(LITERARY_PASSAGES.length / 2)]);
    assert.deepEqual(pool, poolBefore, 'random selection does not reorder or mutate passages');
    assert.throws(() => getRandomPassage([]), /No passages/);
  } finally { Math.random = random; }

  const legacy = { ...first.pack!, version: 1 as const, entries: [
    ...first.pack!.entries.filter(e => e.channel === 'Weather').slice(0, 4),
    ...first.pack!.entries.filter(e => e.channel === 'Headlines'),
    ...first.pack!.entries.filter(e => e.channel === 'Buzz').slice(0, 2)
  ] };
  assert.equal(validateDailyPack(legacy).entries.length, 8, 'legacy packs stay readable, not rewritten or deleted');
  assert.throws(() => validateDailyPack({ ...first.pack, entries: first.pack!.entries.slice(1) }), /Invalid daily pack/);
  const poisoned = structuredClone(first.pack!); poisoned.entries[0].passage.title = '\x1b[2Jbad';
  assert.throws(() => validateDailyPack(poisoned), /Invalid daily passage/);

  failCall = calls + 3;
  const previousBytes = await readFile(join(dir, 'current.json'), 'utf8');
  const failed = await ensureDaily(dir, { force: true }, deps);
  assert.match(failed.error!, /1\/16 passages failed/);
  assert.equal(failed.pack!.id, refreshed.pack!.id);
  assert.equal(await readFile(join(dir, 'current.json'), 'utf8'), previousBytes);
  const before = { collections, calls, setups };
  const failedAgain = await ensureDaily(dir, {}, deps);
  assert.match(failedAgain.error!, /fixture provider failure/);
  assert.deepEqual({ collections, calls, setups }, before, 'failed same-day automatic run does not retry');

  clock = new Date('2026-10-15T20:00:00Z');
  const nextDay = await ensureDaily(dir, {}, deps);
  assert.equal(nextDay.error, undefined);
  assert.equal(nextDay.pack!.day, '2026-10-15');
  assert.equal(calls, 4 * DAILY_PASSAGE_COUNT);
  const collectionFailure = await ensureDaily(dir, { force: true }, { ...deps, collect: async () => { throw new Error('browser unavailable'); } });
  assert.match(collectionFailure.error!, /browser unavailable/);
  assert.equal(collectionFailure.pack!.id, nextDay.pack!.id);
  assert.equal(calls, 4 * DAILY_PASSAGE_COUNT, 'collection failure makes no model calls');
  const controller = new AbortController(); controller.abort();
  await ensureDaily(dir, { force: true, signal: controller.signal }, deps);
  assert.equal(calls, 4 * DAILY_PASSAGE_COUNT);
  const abortDuring = new AbortController();
  const aborted = await ensureDaily(dir, { force: true, signal: abortDuring.signal }, { ...deps,
    collect: async () => { abortDuring.abort(new Error('cancelled fixture')); return sources(); } });
  assert.match(aborted.error!, /cancelled fixture/);
  assert.equal(calls, 4 * DAILY_PASSAGE_COUNT, 'no writing after collection cancellation');
  assert.equal(aborted.pack!.id, nextDay.pack!.id);

  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const collecting = new Promise<void>(resolve => { started = resolve; });
  const winner = ensureDaily(dir, { force: true }, { ...deps, collect: async () => { started(); await gate; return sources(); } });
  await collecting;
  const loser = await ensureDaily(dir, { force: true }, deps);
  assert.match(loser.error!, /locked/);
  release(); await winner;
  assert.equal(calls, 5 * DAILY_PASSAGE_COUNT, 'only one competing process/operation spends calls');
  await assert.rejects(() => readFile(join(dir, '.lock')), { code: 'ENOENT' });

  const state = await readFile(join(dir, 'state.json'), 'utf8');
  await writeFile(join(dir, 'state.json'), '{bad');
  const broken = await ensureDaily(dir, { force: true }, deps);
  assert.ok(broken.error);
  assert.equal(calls, 5 * DAILY_PASSAGE_COUNT, 'corrupt state never silently causes network work');
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), '{bad');
  await writeFile(join(dir, 'state.json'), state);

  // Real child IPC + same-day CLI reads, with a fixture cache: no model/browser transport is reached.
  clock = new Date();
  const current = await ensureDaily(dir, { force: true }, deps);
  assert.ok(current.pack);
  const client = new DailyClient(dir);
  const one = client.run();
  assert.equal(client.busy, true);
  const two = client.run(true);
  assert.equal(one, two, 'repeated refresh while busy coalesces, never queues another generation');
  const childResult = await one;
  assert.equal(childResult.error, undefined);
  assert.equal(childResult.reused, true);
  assert.equal(childResult.pack!.id, current.pack!.id);
  assert.equal(client.busy, false);
  client.dispose();
  const cli = (...args: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/index.ts', '--daily-dir', dir, ...args], { timeout: 15_000 });
  const status = await cli('--daily-status');
  assert.equal(JSON.parse(status.stdout).pack.id, current.pack!.id);
  assert.ok((await cli('--help')).stdout.includes('--daily-refresh'));
  assert.ok((await cli('--list')).stdout.includes('AVAILABLE LITERATURE'));
  assert.equal((await readDailyPack(dir))!.id, current.pack!.id);

  const cancelled = new AbortController(); cancelled.abort(new Error('already cancelled'));
  let completions = 0;
  const cancelledWriter = makePiWriter({
    getPhysicalModel: () => ({ provider: 'openai-codex', id: DAILY_MODEL }),
    completeSimple: async () => { completions++; throw new Error('must not reach runtime'); }
  }, DAILY_MODEL, 'low', cancelled.signal);
  await assert.rejects(() => cancelledWriter.generate(plan[0].seed.request), /already cancelled/);
  assert.equal(completions, 0);
  const during = new AbortController();
  const inFlightWriter = makePiWriter({
    getPhysicalModel: () => ({ provider: 'openai-codex', id: DAILY_MODEL }),
    completeSimple: async (_model, _context, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      during.abort(new Error('cancel in flight'));
    })
  }, DAILY_MODEL, 'low', during.signal);
  await assert.rejects(() => inFlightWriter.generate(plan[0].seed.request), /cancel in flight/);

  let firstFailures = 0;
  const unavailable: DailyDependencies = { ...deps, writer: async () => writer,
    collect: async () => { firstFailures++; throw new Error('first launch offline'); } };
  const emptyDir = join(dir, 'empty-offline');
  const noPack = await ensureDaily(emptyDir, {}, unavailable);
  assert.equal(noPack.pack, undefined);
  assert.match(noPack.error!, /first launch offline/);
  const noRetry = await ensureDaily(emptyDir, {}, unavailable);
  assert.equal(noRetry.pack, undefined); assert.equal(noRetry.reused, true);
  assert.equal(firstFailures, 1, 'a failed FIRST launch is also cached for the day');

  const evalClient = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval',
    `import {DailyClient} from './src/daily/client.ts'; const c = new DailyClient(process.argv[1]); const r = await c.run(); console.log(JSON.stringify({id:r.pack?.id,error:r.error,reused:r.reused})); c.dispose();`, dir], { timeout: 15_000 });
  assert.deepEqual(JSON.parse(evalClient.stdout), { id: current.pack!.id, reused: true }, 'worker must not inherit eval/input-type flags');

  // PTY exercise uses this fixture pack and isolated scores; --no-daily guarantees no network work.
  const pty = await promisify(execFile)('python3', ['src/__tests__/dailyTerminal.py', dir], { timeout: 60_000, maxBuffer: 1024 * 1024 });
  assert.ok(pty.stdout.includes('Daily terminal smoke passed'));
  console.log(pty.stdout.trim());
} finally { await rm(dir, { recursive: true, force: true }); }
console.log('✅ Daily shared collection, day cache, refresh/history, failure retention, cancellation, IPC and mode tests passed.');
