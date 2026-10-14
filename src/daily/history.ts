import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { buildRequest, formatSample, preparePassage, readJson, saveJson, sourceId } from './preview.js';
import { cleanText } from './reddit.js';
import { RATINGS, VOICES, type Attempt, type PreviewSample, type Rating, type Reviews, type SourcePacket, type VoiceId, type Writer, type WriterRequest } from './types.js';

export function promptId(request: WriterRequest): string {
  return createHash('sha256').update(request.systemPrompt).digest('hex');
}
export function attemptName(id: number, voice: VoiceId): string {
  return String(id).padStart(3, '0') + '-' + voice;
}
const filePattern = /^(\d{3,})-(student|blogger|satirist)(\.pending)?\.json$/;

/** Atomically publish a complete read-only record, refusing to replace any existing path. */
export async function writeOnce(path: string, value: unknown): Promise<void> {
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(value, null, 2) + '\n');
      await file.chmod(0o400);
      await file.sync();
    } finally { await file.close(); }
    await link(temporary, path); // Unlike rename, never overwrites the destination.
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function listAttempts(directory: string): Promise<Attempt[]> {
  let files: string[];
  try { files = await readdir(join(directory, 'attempts')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const byId = new Map<number, { attempt: Attempt; pending: boolean }>();
  for (const name of files.sort()) {
    const match = filePattern.exec(name);
    if (!match) continue;
    const id = Number(match[1]);
    let pending = Boolean(match[3]);
    let attempt: Attempt;
    try { attempt = await readJson(join(directory, 'attempts', name)) as Attempt; }
    catch (error) {
      if (!pending || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // A reader can race the pending-file cleanup immediately after final publication.
      if (byId.get(id)?.pending === false) continue;
      attempt = await readJson(join(directory, 'attempts', name.replace('.pending.json', '.json'))) as Attempt;
      pending = false;
    }
    if (!Number.isSafeInteger(id) || id < 1 || attempt.attemptId !== id || attempt.voice !== match[2] ||
        attempt.promptId !== promptId(attempt.request) || !['ready', 'pending', 'error'].includes(attempt.status)) {
      throw new Error('Invalid history record: ' + name);
    }
    const existing = byId.get(id);
    if (existing && (existing.attempt.voice !== attempt.voice || existing.pending === pending)) {
      throw new Error('Conflicting history ID: ' + id);
    }
    // A crash just after publishing the final record can leave its pending file. Prefer final.
    if (!existing || !pending) byId.set(id, { attempt, pending });
  }
  return [...byId.values()].map(entry => entry.attempt).sort((a, b) => a.attemptId - b.attemptId);
}

export async function getAttempt(directory: string, id: number): Promise<Attempt> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Attempt ID must be a positive integer.');
  const attempt = (await listAttempts(directory)).find(a => a.attemptId === id);
  if (!attempt) throw new Error('No attempt ' + id);
  return attempt;
}
async function nextId(directory: string): Promise<number> {
  return ((await listAttempts(directory)).at(-1)?.attemptId ?? 0) + 1;
}

export interface GenerationSeed {
  voice: VoiceId;
  sourceId: string;
  source: Attempt['source'];
  request: WriterRequest;
  replayOf?: number;
}
export async function seedFromPacket(packet: SourcePacket, voice: VoiceId): Promise<GenerationSeed> {
  return {
    voice, sourceId: sourceId(packet), source: { title: packet.post.title, year: new Date(packet.fetchedAt).getUTCFullYear() },
    request: await buildRequest(packet, voice)
  };
}
export function seedFromAttempt(attempt: Attempt): GenerationSeed {
  return {
    voice: attempt.voice, sourceId: attempt.sourceId, source: structuredClone(attempt.source),
    request: structuredClone(attempt.request), replayOf: attempt.attemptId
  };
}

/** Caller holds withPreviewLock. Reserve IDs serially, even for concurrent calls. */
async function reserveAttempt(
  directory: string, seed: GenerationSeed, writer: Writer, execution: 'sequential' | 'parallel'
): Promise<Attempt> {
  await mkdir(join(directory, 'attempts'), { recursive: true });
  const id = await nextId(directory);
  const attempt: Attempt = {
    version: 1, attemptId: id, voice: seed.voice, label: VOICES[seed.voice],
    sourceId: seed.sourceId, source: structuredClone(seed.source), promptId: promptId(seed.request),
    request: structuredClone(seed.request), replayOf: seed.replayOf, execution,
    createdAt: new Date().toISOString(), model: writer.model, thinking: writer.thinking, status: 'pending'
  };
  // If interrupted, this record survives. A later run gets a NEW ID; nothing resumes automatically.
  await writeOnce(join(directory, 'attempts', attemptName(id, seed.voice) + '.pending.json'), attempt);
  return attempt;
}
async function completeAttempt(directory: string, attempt: Attempt, writer: Writer): Promise<Attempt> {
  const path = join(directory, 'attempts', attemptName(attempt.attemptId, attempt.voice));
  const start = performance.now();
  try {
    attempt.result = await writer.generate(structuredClone(attempt.request));
    if (attempt.result.model !== writer.model || attempt.result.thinking !== writer.thinking) {
      throw new Error('Unexpected model/thinking substitution.');
    }
    const { text, warnings } = preparePassage(attempt.result.text);
    attempt.passage = {
      id: `daily-${attempt.attemptId}-${attempt.sourceId.slice(0, 12)}-${attempt.voice}`,
      title: attempt.source.title, author: VOICES[attempt.voice], year: attempt.source.year, genre: 'Daily AI / Reddit', text
    };
    attempt.warnings = warnings;
    attempt.status = 'ready';
  } catch (error) {
    attempt.status = 'error';
    attempt.error = cleanText(error instanceof Error ? error.message : String(error), 1200);
  }
  attempt.elapsedMs = Math.round(performance.now() - start);
  await writeOnce(path + '.json', attempt);
  await unlink(path + '.pending.json');
  return attempt;
}
export async function generateAttempt(directory: string, seed: GenerationSeed, writer: Writer): Promise<Attempt> {
  return completeAttempt(directory, await reserveAttempt(directory, seed, writer, 'sequential'), writer);
}

/** Explicit concurrent comparison; settle all writes before the caller releases the directory lock. */
export async function generateParallel(
  directory: string, jobs: { seed: GenerationSeed; writer: Writer }[], onAttempt: (attempt: Attempt) => void = () => {}
): Promise<{ attempts: Attempt[]; wallMs: number }> {
  const start = performance.now();
  const pending: Attempt[] = [];
  for (const { seed, writer } of jobs) pending.push(await reserveAttempt(directory, seed, writer, 'parallel'));
  const results = await Promise.allSettled(pending.map(async (attempt, index) => {
    const completed = await completeAttempt(directory, attempt, jobs[index].writer);
    onAttempt(completed);
    return completed;
  }));
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(r => r.reason), 'Some comparison operations failed; inspect history and pending records.');
  return { attempts: results.map(r => (r as PromiseFulfilledResult<Attempt>).value), wallMs: Math.round(performance.now() - start) };
}

export async function generateSequential(
  directory: string, seeds: GenerationSeed[], writer: Writer, onAttempt: (attempt: Attempt) => void = () => {}
): Promise<{ attempts: Attempt[]; wallMs: number }> {
  const start = performance.now();
  const attempts: Attempt[] = [];
  for (const seed of seeds) {
    const attempt = await generateAttempt(directory, seed, writer);
    attempts.push(attempt);
    onAttempt(attempt);
  }
  return { attempts, wallMs: Math.round(performance.now() - start) };
}

/** Explicit, idempotent import. Originals remain byte-for-byte unchanged. Caller holds the lock. */
export async function migrateLegacy(directory: string, execution: Attempt['execution'] = 'unknown'): Promise<Attempt[]> {
  await mkdir(join(directory, 'attempts'), { recursive: true });
  const history = await listAttempts(directory);
  const imported: Attempt[] = [];
  for (const voice of Object.keys(VOICES) as VoiceId[]) {
    const file = voice + '.json';
    let raw: string;
    try { raw = await readFile(join(directory, file), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const sha256 = createHash('sha256').update(raw).digest('hex');
    if (history.some(a => a.importedFrom?.file === file && a.importedFrom.sha256 === sha256)) continue;
    const sample = JSON.parse(raw) as PreviewSample;
    if (sample.version !== 1 || sample.voice !== voice || typeof sample.request?.systemPrompt !== 'string') {
      throw new Error('Invalid legacy sample: ' + file);
    }
    // Recover original source metadata from the exact user input, not today's context.json.
    const input = sample.request.userPrompt;
    const separator = input.indexOf('\n\n');
    const packet = JSON.parse(input.slice(separator + 2)) as SourcePacket;
    if (separator < 0 || sourceId(packet) !== sample.sourceId) throw new Error('Legacy source hash mismatch: ' + file);
    const attempt: Attempt = {
      ...sample, attemptId: await nextId(directory), promptId: promptId(sample.request), execution,
      source: { title: packet.post.title, year: new Date(packet.fetchedAt).getUTCFullYear() },
      importedFrom: { file, sha256 }
    };
    const suffix = sample.status === 'pending' ? '.pending.json' : '.json';
    await writeOnce(join(directory, 'attempts', attemptName(attempt.attemptId, voice) + suffix), attempt);
    history.push(attempt);
    imported.push(attempt);
  }
  return imported;
}

export async function readReviews(directory: string): Promise<Reviews> {
  try {
    const reviews = await readJson(join(directory, 'reviews.json')) as Reviews;
    if (!reviews || typeof reviews !== 'object' || Array.isArray(reviews) || Object.entries(reviews).some(([id, r]) =>
      !/^[1-9]\d*$/.test(id) || !r || (r.rating !== undefined && !RATINGS.includes(r.rating)) || typeof r.note !== 'string')) {
      throw new Error('Invalid reviews.json; refusing to discard existing feedback.');
    }
    return reviews;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
export async function markAttempt(directory: string, id: number, rating: Rating | undefined, note?: string): Promise<void> {
  await getAttempt(directory, id);
  if (rating !== undefined && !RATINGS.includes(rating)) throw new Error('Rating must be good, mid, bad or unrated.');
  const reviews = await readReviews(directory);
  reviews[String(id)] = { rating, note: note ?? reviews[String(id)]?.note ?? '', updatedAt: new Date().toISOString() };
  await saveJson(join(directory, 'reviews.json'), reviews);
}
export function reviewAttempts(attempts: Attempt[], reviews: Reviews, includeMid = false): Attempt[] {
  return attempts.filter(a => a.status === 'ready' && (reviews[a.attemptId]?.rating === 'good' ||
    (includeMid && reviews[a.attemptId]?.rating === 'mid')))
    .sort((a, b) => Number(reviews[a.attemptId]?.rating === 'mid') - Number(reviews[b.attemptId]?.rating === 'mid') || a.attemptId - b.attemptId);
}
export function formatAttempt(attempt: Attempt, reviews: Reviews): string {
  const review = reviews[attempt.attemptId];
  return [
    `\n#${String(attempt.attemptId).padStart(3, '0')} | ${review?.rating ?? 'unrated'} | ${attempt.execution} | ${attempt.createdAt}`,
    `Prompt: ${attempt.promptId.slice(0, 12)} | Source: ${attempt.sourceId.slice(0, 12)}${attempt.replayOf ? ' | Replay of #' + attempt.replayOf : ''}`,
    formatSample(attempt), ...(review?.note ? ['Note: ' + cleanText(review.note)] : [])
  ].join('\n');
}
export function formatTable(attempts: Attempt[], reviews: Reviews): string {
  return ['ID   VOICE     MARK     STATUS   THINK  SECONDS MODEL                       PROMPT       SOURCE',
    ...attempts.map(a => [
      String(a.attemptId).padStart(3, '0').padEnd(4), a.voice.padEnd(9),
      (reviews[a.attemptId]?.rating ?? 'unrated').padEnd(8), a.status.padEnd(8), a.thinking.padEnd(6),
      (a.elapsedMs === undefined ? '-' : (a.elapsedMs / 1000).toFixed(2)).padStart(7),
      a.model.replace(/^openai-codex\//, '').padEnd(27), a.promptId.slice(0, 12), a.sourceId.slice(0, 12)
    ].join(' '))
  ].join('\n');
}

/** Descriptive counts, not an automated score. Model/effort stay separate for comparisons. */
export function summarizePrompts(attempts: Attempt[], reviews: Reviews) {
  const groups = new Map<string, {
    voice: VoiceId; promptId: string; model: string; thinking: Attempt['thinking'];
    good: number; mid: number; bad: number; unrated: number; errors: number; ids: number[];
  }>();
  for (const attempt of attempts) {
    const key = JSON.stringify([attempt.voice, attempt.promptId, attempt.model, attempt.thinking]);
    const group = groups.get(key) ?? {
      voice: attempt.voice, promptId: attempt.promptId, model: attempt.model, thinking: attempt.thinking,
      good: 0, mid: 0, bad: 0, unrated: 0, errors: 0, ids: []
    };
    group[reviews[attempt.attemptId]?.rating ?? 'unrated']++;
    if (attempt.status === 'error') group.errors++;
    group.ids.push(attempt.attemptId);
    groups.set(key, group);
  }
  const voices = Object.keys(VOICES);
  return [...groups.values()].sort((a, b) => voices.indexOf(a.voice) - voices.indexOf(b.voice) ||
    a.promptId.localeCompare(b.promptId) || a.model.localeCompare(b.model) || a.ids[0] - b.ids[0]);
}
export function formatPromptTable(attempts: Attempt[], reviews: Reviews): string {
  return ['VOICE     PROMPT       MODEL                       THINK  GOOD MID BAD UNRATED ERRORS IDS',
    ...summarizePrompts(attempts, reviews).map(g => [
      g.voice.padEnd(9), g.promptId.slice(0, 12), g.model.replace(/^openai-codex\//, '').padEnd(27),
      g.thinking.padEnd(6), String(g.good).padStart(4), String(g.mid).padStart(3), String(g.bad).padStart(3),
      String(g.unrated).padStart(7), String(g.errors).padStart(6), g.ids.map(id => String(id).padStart(3, '0')).join(',')
    ].join(' '))
  ].join('\n');
}
