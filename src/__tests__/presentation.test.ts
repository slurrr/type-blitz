import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAttempt, seedFromAttempt, type GenerationSeed } from '../daily/history.js';
import { parsePresentation, PRESENTATION_FORMAT, PRESENTATION_LIMITS, withPresentation } from '../daily/presentation.js';
import { withPreviewLock } from '../daily/preview.js';
import { renderAttemptHtml } from '../daily/requestView.js';
import type { Writer } from '../daily/types.js';

const text = 'There is something wonderfully stubborn about fixing a toaster in a world that would rather sell you another one. Nobody here is disrupting anything except a loose wire. For once, progress means sitting beside a neighbor, borrowing a screwdriver, and refusing to throw the whole damn thing away.';
const output = { title: 'Repairing together', name: 'Simon', descriptor: 'Kilgore, TX', text };
assert.deepEqual(parsePresentation(JSON.stringify(output)), output);
for (const [key, limit] of Object.entries(PRESENTATION_LIMITS)) {
  assert.equal((parsePresentation(JSON.stringify({ ...output, [key]: 'A'.repeat(limit) })) as unknown as Record<string, string>)[key].length, limit);
  for (const bad of ['', '   ', ' leading', 'trailing ', 'A'.repeat(limit + 1), 'Two\nlines', '\x1b[2J', '<script>', '😎', 'https://a.co']) {
    assert.throws(() => parsePresentation(JSON.stringify({ ...output, [key]: bad })), /Invalid presentation/);
  }
}
for (const bad of [text, '```json\n' + JSON.stringify(output) + '\n```', '{broken', 'null', '[]',
  JSON.stringify({ ...output, rationale: 'Extra commentary' }), JSON.stringify({ title: output.title, text }),
  JSON.stringify({ ...output, text: 3 }), 'x'.repeat(6001)]) {
  assert.throws(() => parsePresentation(bad));
}
const originalRequest = { systemPrompt: 'A frozen voice instruction.', userPrompt: 'All source context, unchanged.' };
const request = await withPresentation(originalRequest);
assert.equal(request.outputFormat, PRESENTATION_FORMAT);
assert.equal(request.userPrompt, originalRequest.userPrompt);
assert.ok(request.systemPrompt.startsWith(originalRequest.systemPrompt + '\n\n'));
assert.deepEqual(Object.keys(originalRequest).sort(), ['systemPrompt', 'userPrompt']);
const directory = await mkdtemp(join(tmpdir(), 'type-blitz-presentation-'));
try {
  const seed: GenerationSeed = { voice: 'satirist', sourceId: 'fixture-source', request,
    source: { title: 'The full original source headline stays here without being shortened or replaced', year: 2026 } };
  let calls = 0, raw = JSON.stringify(output);
  const writer: Writer = { model: 'fixture', thinking: 'low', async generate(input) {
    calls++;
    return { model: 'fixture', thinking: 'low', text: raw,
      audit: { ...input, payloadVerified: true, tools: [], messageRoles: ['user'] } };
  } };
  const generate = () => withPreviewLock(directory, () => generateAttempt(directory, seed, writer));
  const ready = await generate();
  assert.equal(ready.status, 'ready');
  assert.equal(calls, 1, 'metadata never adds a model call');
  assert.equal(ready.passage!.title, output.title);
  assert.equal(ready.passage!.author, 'Simon · Kilgore, TX');
  assert.equal(ready.passage!.text, text, 'identity/title do not become typing text');
  assert.equal(ready.source.title, seed.source.title);
  assert.equal(ready.result!.text, raw, 'raw JSON is retained exactly');
  const html = renderAttemptHtml(ready, directory);
  for (const s of [output.title, 'Simon · Kilgore, TX', 'Fictional Speaker', seed.source.title]) assert.ok(html.includes(s));
  const savedPath = join(directory, 'attempts', '001-satirist.json');
  const saved = await readFile(savedPath, 'utf8');
  assert.deepEqual(seedFromAttempt(ready).request, request, 'replay keeps its structured contract');
  const invalid = [text, JSON.stringify({ ...output, title: 'x'.repeat(36) }), JSON.stringify({ ...output, text: 'Two\nparagraphs' })];
  for (const bad of invalid) {
    raw = bad;
    const failure = await generate();
    assert.equal(failure.status, 'error');
    assert.equal(failure.passage, undefined, 'no silent fallback to the original overlong title');
    assert.equal(failure.result!.text, bad, 'failed metadata/prose remains observable');
  }
  assert.equal(calls, 1 + invalid.length, 'no automatic retries');
  assert.equal(await readFile(savedPath, 'utf8'), saved, 'later generations cannot change saved identities');
  raw = text;
  const legacy = await withPreviewLock(directory, () => generateAttempt(directory, { ...seed, request: originalRequest }, writer));
  assert.equal(legacy.status, 'ready');
  assert.equal(legacy.passage!.title, seed.source.title, 'old prose-only requests remain replayable');
} finally { await rm(directory, { recursive: true, force: true }); }
console.log('✅ Short titles and fictional speakers: strict metadata, one call, preserved sources/raw output, legacy replay and failure retention passed.');
