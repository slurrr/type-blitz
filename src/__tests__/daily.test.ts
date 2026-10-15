import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReddit, readFeedDocument, type BrowserCommand } from '../daily/browser.js';
import { cleanText, extractComments, FEED_URL, makePacket, selectPost } from '../daily/reddit.js';
import { makePiWriter, verifyPayload, type PiContext, type PiRuntime } from '../daily/pi.js';
import { buildRequest, collectOnce, preparePassage, readPacket, sourceId, withPreviewLock } from '../daily/preview.js';
import { attemptName, generateAttempt, generateSequential, getAttempt, seedFromAttempt, seedFromPacket } from '../daily/history.js';
import { VOICES, type VoiceId, type WriterRequest } from '../daily/types.js';

const now = Date.now();
const listing = (children: unknown[]) => ({ kind: 'Listing', data: { children } });
const postData = {
  id: 'abc', title: 'A neighborhood repair cafe is bringing broken appliances and their owners back together',
  selftext: '', subreddit: 'example', permalink: '/r/example/comments/abc/repair_cafe/',
  url: 'https://example.org/repair-cafe', score: 1200, num_comments: 350, created_utc: (now - 3600_000) / 1000
};
const post = (overrides = {}) => ({ kind: 't3', data: { ...postData, ...overrides } });
function comment(id: string, body: string, extra = {}) {
  return { kind: 't1', data: {
    name: 't1_' + id, body, author: 'reader', score: 30, parent_id: 't3_abc', replies: '', ...extra
  } };
}
const substantive = [
  comment('one', 'Repair should be normal, not a charming exception.', { replies: listing([
    comment('reply', 'Some repairs cost more than replacing the entire appliance.', { parent_id: 't1_one' }),
    comment('wrongparent', 'This reply belongs to another branch and must not be attached here.')
  ]) }),
  comment('two', 'Learning a skill with your neighbors sounds like a lovely afternoon.'),
  comment('three', 'Nice idea, but manufacturers still make replacement parts impossible to find.')
];
const thread = [listing([post()]), listing([
  comment('mod', 'Please review the rules before replying to this post.', { distinguished: 'moderator' }),
  comment('bot', 'I am a bot and this action was performed automatically.'),
  comment('del', '[deleted]'), comment('short', 'lol'),
  comment('gif', '![gif](giphy|E1fXBVW9X3DIwnUS0l)'),
  ...substantive,
  comment('duplicate', 'Repair should be normal, not a charming exception.'),
  { kind: 'more', data: { children: ['unfetched'] } }
])];

const selected = selectPost(listing([
  post({ id: 'old', created_utc: (now - 4 * 86400_000) / 1000 }),
  post({ id: 'video', url: 'https://v.redd.it/video', is_video: true }),
  post({ id: 'vague', title: 'Look at this!', url: 'https://example.org/vague' }),
  post({ id: 'future', created_utc: (now + 86400_000) / 1000, url: 'https://example.org/future' }),
  post({ id: 'removed', selftext: '[removed]', url: 'https://example.org/removed' }),
  post()
]), now);
// An ineligible older duplicate must not prevent selecting the current story.
assert.equal(selected.id, 'abc');
assert.equal(selected.permalink, 'https://www.reddit.com/r/example/comments/abc/repair_cafe/');
assert.throws(() => selectPost({ error: 403 }), /Listing/);
assert.throws(() => selectPost(listing([post({ is_video: true })]), now), /No recent/);
assert.throws(() => selectPost(listing([post({ num_comments: 1 })]), now), /No recent/);
assert.throws(() => selectPost(listing([post({ permalink: '//evil.example/path' })]), now), /No recent/);
assert.equal(cleanText('\x1b[31mHello\x1b[0m\nworld\u202e!'), 'Hello world !');
const comments = extractComments(thread, 'abc');
assert.equal(comments.length, 3);
assert.equal(comments[0].replies.length, 1);
assert.equal(comments[0].replies[0].parentId, comments[0].id);
assert.ok(!JSON.stringify(comments).includes('author'));
assert.throws(() => extractComments(thread, 'different'), /different post/);
assert.throws(() => extractComments([thread[0], listing([substantive[0]])], 'abc'), /Fewer than three/);
const many = [thread[0], listing(Array.from({ length: 20 }, (_, i) => comment('c' + i, 'A substantive and unique opinion about repair number ' + i, {
  replies: listing(Array.from({ length: 6 }, (_, r) => comment('r' + i + 'n' + r, `A substantial reply to comment ${i}, number ${r}.`, { parent_id: 't1_c' + i })))
})))];
assert.equal(extractComments(many, 'abc').length, 6);
assert.equal(extractComments(many, 'abc')[0].replies.length, 2);

const commands: string[][] = [];
const browser: BrowserCommand = async args => {
  commands.push(args);
  if (args[0] === 'open') { assert.equal(args[1], FEED_URL); return { tabId: 'owned-tab' }; }
  assert.deepEqual(args.slice(-2), ['--tab', 'owned-tab']);
  if (args[0] === 'close') return {};
  if (args[1].includes('document.body')) {
    assert.ok(!args[1].includes('fetch('), 'document readiness wait must not refetch the feed');
    return { result: { loading: false, value: listing([post()]) } };
  }
  assert.ok(args[1].includes('sort=top&limit=20&depth=2'));
  return { result: thread };
};
let readinessChecks = 0;
assert.deepEqual(await readFeedDocument(async args => {
  assert.equal(args[0], 'eval', 'readiness checks never navigate or fetch');
  if (++readinessChecks === 1) throw new Error('Runtime.evaluate: Execution context was destroyed.');
  if (readinessChecks === 2) return { result: { loading: true } };
  return { result: { loading: false, value: listing([post()]) } };
}, 'owned-tab'), listing([post()]));
assert.equal(readinessChecks, 3);
await assert.rejects(() => readFeedDocument(async () => { throw new Error('HTTP 403'); }, 'owned-tab'), /403/);
const packet = await collectReddit(browser);
assert.equal(commands.length, 4, 'one navigation, two evals (one fetch), one targeted close');
assert.equal(commands.at(-1)?.[0], 'close');
commands.length = 0;
await assert.rejects(() => collectReddit(async args => {
  if (args[0] === 'eval') throw new Error('blocked');
  return browser(args);
}), /blocked/);
assert.deepEqual(commands.map(c => c[0]), ['open', 'close'], 'close own tab even on a block; no retries');

const dir = await mkdtemp(join(tmpdir(), 'type-blitz-daily-test-'));
try {
  let collections = 0;
  const collector = async () => { collections++; return packet; };
  await withPreviewLock(dir, async () => {
    await assert.rejects(() => withPreviewLock(dir, async () => {}), /locked/);
    await collectOnce(dir, collector);
    await collectOnce(dir, collector);
    assert.equal(collections, 1, 'cached collection must not touch the browser');
  });
  assert.equal(sourceId(await readPacket(dir)), sourceId(packet));
  assert.notEqual(sourceId(makePacket(selected, comments, new Date(now + 1000).toISOString())), sourceId(packet));

  const contexts: PiContext[] = [];
  let requests = 0;
  let active = 0;
  let maxActive = 0;
  const prose = 'There is something wonderfully stubborn about fixing a toaster in a world that would rather sell you another one. Nobody here is disrupting anything except a loose wire. For once, progress means sitting beside a neighbor, borrowing a screwdriver, and refusing to throw the whole damn thing away.';
  const payload = (request: WriterRequest) => ({
    instructions: request.systemPrompt, store: false, tool_choice: 'none', reasoning: { effort: 'xhigh' },
    input: [{ role: 'user', content: [{ type: 'input_text', text: request.userPrompt }] }]
  });
  const runtime: PiRuntime = {
    getPhysicalModel: (provider, id) => ({ provider, id }),
    async completeSimple(model, context, options) {
      requests++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      contexts.push(context);
      assert.equal(context.messages.length, 1);
      assert.equal(context.messages[0].role, 'user');
      assert.deepEqual(context.tools, []);
      assert.equal(options.maxRetries, 0);
      assert.equal(options.reasoning, 'xhigh');
      assert.equal(options.transport, 'sse');
      assert.equal(options.cacheRetention, 'none');
      assert.equal(options.toolChoice, 'none');
      options.onPayload(payload({ systemPrompt: context.systemPrompt, userPrompt: context.messages[0].content }));
      return { stopReason: 'stop', provider: model.provider, model: model.id, content: [{ type: 'text',
        text: JSON.stringify({ title: 'Repairing together', name: 'Simon', descriptor: 'Kilgore, TX', text: prose }) }] };
    }
  };
  const writer = makePiWriter(runtime, 'test-model');
  const seeds = await Promise.all((Object.keys(VOICES) as VoiceId[]).map(voice => seedFromPacket(packet, voice)));
  const { attempts: samples } = await generateSequential(dir, seeds, writer);
  assert.equal(requests, 3);
  assert.equal(maxActive, 1, 'prototype timing runs must be sequential');
  assert.equal(collections, 1, 'generation never fetches Reddit');
  assert.equal(new Set(contexts.map(c => c.systemPrompt)).size, 3);
  assert.equal(new Set(contexts.map(c => c.messages[0].content)).size, 1, 'all voices receive identical material');
  assert.equal(new Set(contexts.map(c => c.messages)).size, 3, 'separate histories');
  for (const sample of samples) {
    assert.equal(sample.status, 'ready');
    assert.equal(sample.passage?.text, prose);
    assert.deepEqual(sample.warnings, []);
    assert.equal(sample.result?.audit.payloadVerified, true);
    assert.equal(sample.sourceId, sourceId(packet));
    assert.ok(sample.request.userPrompt.includes(comments[0].text));
  }
  const originalPath = join(dir, 'attempts', attemptName(1, 'student') + '.json');
  const originalBefore = await readFile(originalPath, 'utf8');
  const bloggerPath = join(dir, 'attempts', attemptName(2, 'blogger') + '.json');
  const bloggerBefore = await readFile(bloggerPath, 'utf8');
  const replay = await generateAttempt(dir, seedFromAttempt(samples[0]), writer);
  assert.equal(replay.attemptId, 4);
  assert.equal(replay.replayOf, 1);
  assert.deepEqual(replay.request, samples[0].request);
  assert.equal(requests, 4);
  assert.equal(await readFile(originalPath, 'utf8'), originalBefore, 'reruns never overwrite their original');
  assert.equal(await readFile(bloggerPath, 'utf8'), bloggerBefore, 'single voice rerun preserves other samples');
  const req = await buildRequest(packet, 'student');
  assert.ok(req.systemPrompt.includes('nihilistic college student'));
  assert.ok(!req.systemPrompt.includes('mommy blogger'));
  verifyPayload(payload(req), req, 'xhigh');
  assert.throws(() => verifyPayload(payload(req), req, 'low'), /isolation/);
  assert.throws(() => verifyPayload({ ...payload(req), instructions: 'Coding agent\n' + req.systemPrompt }, req, 'xhigh'), /isolation/);
  assert.throws(() => verifyPayload({ ...payload(req), tools: [{ name: 'bash' }] }, req, 'xhigh'), /isolation/);
  assert.throws(() => verifyPayload({ ...payload(req), input: [...payload(req).input, { role: 'assistant' }] }, req, 'xhigh'), /isolation/);
  assert.throws(() => verifyPayload({ ...payload(req), store: true }, req, 'xhigh'), /isolation/);
  const noAudit = makePiWriter({ ...runtime, completeSimple: async model => ({
    stopReason: 'stop', provider: model.provider, model: model.id, content: [{ type: 'text', text: prose }]
  }) }, 'test-model');
  await assert.rejects(() => noAudit.generate(req), /isolation check/);
  const broken = await generateAttempt(dir, seeds[0], {
    model: 'fake', thinking: 'xhigh', generate: async () => { throw new Error('usage limit reached'); }
  });
  assert.equal(broken.status, 'error');
  assert.equal((await getAttempt(dir, broken.attemptId)).error, 'usage limit reached');
  assert.equal(requests, 4, 'no recovery/rewrite calls');
  const offWriter = makePiWriter({ ...runtime, completeSimple: async (model, context, options) => {
    assert.equal(options.reasoning, undefined, 'off omits Pi reasoning, rather than requesting low');
    options.onPayload({ ...payload({ systemPrompt: context.systemPrompt, userPrompt: context.messages[0].content }), reasoning: { effort: 'none' } });
    return { stopReason: 'stop', provider: model.provider, model: model.id, content: [{ type: 'text', text: prose }] };
  } }, 'test-model', 'off');
  const off = await offWriter.generate(req);
  assert.equal(off.thinking, 'off');
  assert.equal(off.audit.reasoningEffort, 'none');
  assert.throws(() => verifyPayload(payload(req), req, 'off'), /isolation/, 'off must fail closed if provider inserts reasoning');
  assert.equal(preparePassage('“Hello,” she said.').text, '"Hello," she said.');
  assert.equal(preparePassage('Short.').warnings.length, 1);
  assert.throws(() => preparePassage('Line one.\nLine two.'), /paragraph/);
  assert.throws(() => preparePassage('Emoji 😎'), /paragraph/);
  assert.throws(() => preparePassage('Visit https://example.org'), /paragraph/);
  assert.throws(() => preparePassage(''), /Empty/);
  await collectOnce(dir, collector, true);
  assert.equal(collections, 2, 'only explicit refresh fetches again');
  await writeFile(join(dir, 'context.json'), '{}');
  await assert.rejects(() => collectOnce(dir, collector), /Invalid frozen/);
  assert.equal(collections, 2, 'corrupt input does not cause a hidden refetch');
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log('✅ Daily extraction, frozen-input reuse, independent voices, isolation and failure tests passed.');
