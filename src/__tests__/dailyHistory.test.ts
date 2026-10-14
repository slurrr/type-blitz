import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRequest, sourceId, withPreviewLock } from '../daily/preview.js';
import { attemptName, formatTable, generateAttempt, getAttempt, listAttempts, markAttempt, migrateLegacy, readReviews, reviewAttempts, seedFromAttempt, seedFromPacket, summarizePrompts, writeOnce } from '../daily/history.js';
import { VOICES, type PreviewSample, type SourcePacket, type VoiceId, type Writer } from '../daily/types.js';

const packet: SourcePacket = {
  version: 1, feed: 'fixture', fetchedAt: '2026-10-14T00:00:00.000Z', selection: 'fixture', limitations: [],
  post: { id: 'fixture', title: 'A repair cafe for a neighborhood', text: '', subreddit: 'example',
    permalink: 'https://www.reddit.com/r/example/comments/fixture/', url: 'https://example.org',
    publishedAt: '2026-10-13T00:00:00.000Z', score: 100, commentCount: 30 },
  comments: []
};
const prose = 'There is something wonderfully stubborn about fixing a toaster in a world that would rather sell you another one. Nobody here is disrupting anything except a loose wire. For once, progress means sitting beside a neighbor, borrowing a screwdriver, and refusing to throw the whole damn thing away.';
const dir = await mkdtemp(join(tmpdir(), 'type-blitz-history-test-'));
try {
  const originals = new Map<string, string>();
  for (const voice of Object.keys(VOICES) as VoiceId[]) {
    const sample: PreviewSample = {
      version: 1, voice, label: VOICES[voice], sourceId: sourceId(packet), createdAt: packet.fetchedAt,
      model: 'openai-codex/fixture', thinking: 'xhigh', status: 'ready', elapsedMs: 100,
      request: await buildRequest(packet, voice),
      passage: { id: voice, text: prose, title: packet.post.title, year: 2026, author: VOICES[voice], genre: 'fixture' }
    };
    const raw = JSON.stringify(sample, null, 2) + '\n';
    originals.set(voice, raw);
    await writeFile(join(dir, voice + '.json'), raw);
  }
  let history = await withPreviewLock(dir, () => migrateLegacy(dir, 'parallel'));
  assert.deepEqual(history.map(a => a.attemptId), [1, 2, 3]);
  assert.ok(history.every(a => a.execution === 'parallel'));
  for (const attempt of history) {
    assert.equal(await readFile(join(dir, attempt.voice + '.json'), 'utf8'), originals.get(attempt.voice));
    assert.deepEqual(attempt.request, JSON.parse(originals.get(attempt.voice)!).request);
    assert.equal(attempt.sourceId, sourceId(packet));
  }
  assert.deepEqual(await withPreviewLock(dir, () => migrateLegacy(dir, 'parallel')), [], 'migration is idempotent');
  const path = join(dir, 'attempts', '001-student.json');
  const original = await readFile(path, 'utf8');
  assert.equal((await stat(path)).mode & 0o222, 0, 'finished records are read-only');
  await assert.rejects(() => writeOnce(path, { replacement: true }), { code: 'EEXIST' });
  assert.equal(await readFile(path, 'utf8'), original);

  // Marks/notes are independently editable; history bytes must never change.
  await withPreviewLock(dir, async () => {
    await markAttempt(dir, 1, 'good', 'This voice works.');
    await markAttempt(dir, 2, 'mid', 'Fine for its audience.');
    await markAttempt(dir, 3, 'bad', 'Keep as a learning example.');
  });
  let reviews = await readReviews(dir);
  assert.deepEqual(reviewAttempts(history, reviews).map(a => a.attemptId), [1]);
  assert.deepEqual(reviewAttempts(history, reviews, true).map(a => a.attemptId), [1, 2]);
  assert.equal((await listAttempts(dir)).length, 3, 'bad remains in history');
  assert.ok(formatTable(history, reviews).includes('bad'));
  let groups = summarizePrompts(history, reviews);
  assert.equal(groups.find(g => g.voice === 'student')?.good, 1);
  assert.equal(groups.find(g => g.voice === 'blogger')?.mid, 1);
  assert.equal(groups.find(g => g.voice === 'satirist')?.bad, 1, 'bad is evidence in prompt-quality summaries');
  groups = summarizePrompts([...history, { ...history[0], attemptId: 50, thinking: 'off' }], reviews);
  assert.equal(groups.filter(g => g.voice === 'student').length, 2, 'never pool different thinking settings into a prompt score');
  assert.equal(groups.find(g => g.thinking === 'off')?.unrated, 1, 'unreviewed is not a fourth quality tier');
  await withPreviewLock(dir, () => markAttempt(dir, 3, 'good'));
  assert.equal((await readReviews(dir))['3'].note, 'Keep as a learning example.', 'changing rating preserves note');
  await withPreviewLock(dir, () => markAttempt(dir, 2, undefined));
  assert.equal((await readReviews(dir))['2'].rating, undefined);
  await assert.rejects(() => markAttempt(dir, 999, 'good'), /No attempt/);
  await assert.rejects(() => getAttempt(dir, NaN), /positive integer/);
  assert.equal(await readFile(path, 'utf8'), original);

  // Exact replay never reads context.json or rebuilds the saved prompt from current files.
  const saved = await getAttempt(dir, 1);
  saved.request.systemPrompt += '\nA historical instruction no longer present in the prompt files.';
  const seed = seedFromAttempt(saved);
  saved.request.systemPrompt = 'mutated outside the seed';
  assert.ok(seed.request.systemPrompt.endsWith('prompt files.'));
  const fake: Writer = {
    model: 'openai-codex/fixture', thinking: 'off',
    async generate(request) {
      assert.deepEqual(request, seed.request);
      request.systemPrompt = 'malicious transport mutation';
      return { text: prose, model: 'openai-codex/fixture', thinking: 'off',
        audit: { systemPrompt: seed.request.systemPrompt, userPrompt: seed.request.userPrompt,
          tools: [], messageRoles: ['user'], payloadVerified: true, reasoningEffort: 'none' } };
    }
  };
  const replay = await withPreviewLock(dir, () => generateAttempt(dir, seed, fake));
  assert.equal(replay.attemptId, 4);
  assert.equal(replay.replayOf, 1);
  assert.equal(replay.execution, 'sequential');
  assert.deepEqual(replay.request, seed.request, 'transport cannot mutate the recorded instructions');
  assert.equal(await readFile(path, 'utf8'), original);

  // A process crash leaves an identifiable immutable pending record and consumes its ID.
  const pending = { ...replay, attemptId: 5, status: 'pending' as const, result: undefined, passage: undefined };
  const pendingPath = join(dir, 'attempts', attemptName(5, pending.voice) + '.pending.json');
  await writeOnce(pendingPath, pending);
  history = await listAttempts(dir);
  assert.equal(history.at(-1)?.status, 'pending');
  const failureSeed = await seedFromPacket(packet, 'student');
  const failure = await withPreviewLock(dir, () => generateAttempt(dir, failureSeed, {
    ...fake, generate: async () => { throw new Error('test model failed'); }
  }));
  assert.equal(failure.attemptId, 6);
  assert.equal(failure.status, 'error');
  await markAttempt(dir, 6, 'good');
  reviews = await readReviews(dir);
  assert.ok(!reviewAttempts(await listAttempts(dir), reviews, true).some(a => a.status !== 'ready'), 'review hides failures even if mistakenly marked good');

  // Publish completion while leaving pending behind to simulate interruption during cleanup.
  await writeOnce(pendingPath.replace('.pending.json', '.json'), { ...pending, status: 'error', error: 'interrupted' });
  assert.equal((await getAttempt(dir, 5)).status, 'error', 'completed record takes priority over leftover pending');
  assert.equal((await listAttempts(dir)).length, 6);
  await writeFile(join(dir, 'reviews.json'), '{broken');
  await assert.rejects(() => markAttempt(dir, 1, 'bad'), SyntaxError);
  assert.equal(await readFile(path, 'utf8'), original);
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log('✅ Immutable history, idempotent migration, ratings/review, exact replay and interruption tests passed.');
