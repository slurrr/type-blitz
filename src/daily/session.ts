import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Passage } from '../types.js';
import { generateParallel, seedFromPacket, writeOnce, type GenerationSeed } from './history.js';
import { seedFromHeadline } from './headlines.js';
import { createPiWriter } from './pi.js';
import { preparePassage, readJson, saveJson, withPreviewLock } from './preview.js';
import { cleanText } from './reddit.js';
import { collectDailySources, type DailySources } from './sources.js';
import type { VoiceId, Writer } from './types.js';
import { HELENA, seedFromWeather } from './weather.js';

export const DAILY_MODEL = 'gpt-6.1-sol';
export const DAILY_THINKING = 'low';
export const dailyDirectory = () => process.env.TYPE_BLITZ_DAILY_GAME_DIR ?? join(homedir(), 'runs/type-blitz/daily');
export const dailyDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: HELENA.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);
export type DailyChannel = 'Weather' | 'Headlines' | 'Buzz';
export interface DailyEntry { channel: DailyChannel; attemptId: number; passage: Passage }
export interface DailyPack {
  version: 1; id: string; day: string; generatedAt: string;
  model: string; thinking: 'low'; entries: DailyEntry[];
}
interface DailyState {
  version: 1; day: string; runId: string; startedAt: string;
  status: 'running' | 'ready' | 'error'; error?: string;
}
export interface DailyResult { pack?: DailyPack; reused: boolean; error?: string }
export interface DailyDependencies {
  collect(signal: AbortSignal, progress: (message: string) => void): Promise<DailySources>;
  writer(signal: AbortSignal): Promise<Writer>;
  now(): Date;
}
const dependencies: DailyDependencies = {
  collect: collectDailySources,
  writer: signal => createPiWriter(DAILY_MODEL, DAILY_THINKING, signal),
  now: () => new Date()
};
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && validDate(value);

export function validateDailyPack(value: unknown): DailyPack {
  const p = value as DailyPack | null;
  if (!p || p.version !== 1 || typeof p.id !== 'string' || !/^[\da-f-]{36}$/.test(p.id) ||
      !validDay(p.day) || !validDate(p.generatedAt) || p.model !== 'openai-codex/' + DAILY_MODEL || p.thinking !== 'low' ||
      !Array.isArray(p.entries) || p.entries.length !== 8) throw new Error('Invalid daily pack; inspect current.json.');
  const ids = new Set<string>(), attempts = new Set<number>();
  for (const e of p.entries) {
    const passage = e?.passage;
    if (!e || !['Weather', 'Headlines', 'Buzz'].includes(e.channel) || !Number.isSafeInteger(e.attemptId) || e.attemptId < 1 ||
        !passage || !Number.isInteger(passage.year) || ['id', 'title', 'author', 'genre'].some(key => {
          const value = passage[key as keyof Passage];
          return typeof value !== 'string' || !value || value !== cleanText(value, 500);
        }) || preparePassage(passage.text).text !== passage.text || ids.has(passage.id) || attempts.has(e.attemptId)) {
      throw new Error('Invalid daily passage; inspect current.json.');
    }
    ids.add(passage.id); attempts.add(e.attemptId);
  }
  if (p.entries.filter(e => e.channel === 'Weather').length !== 4 ||
      p.entries.filter(e => e.channel === 'Headlines').length !== 2 || p.entries.filter(e => e.channel === 'Buzz').length !== 2) {
    throw new Error('Incomplete daily channel mix.');
  }
  return p;
}
export async function readDailyPack(directory: string): Promise<DailyPack | undefined> {
  try { return validateDailyPack(await readJson(join(directory, 'current.json'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
async function readState(directory: string): Promise<DailyState | undefined> {
  try {
    const state = await readJson(join(directory, 'state.json')) as DailyState;
    if (!state || state.version !== 1 || !validDay(state.day) || !validDate(state.startedAt) ||
        typeof state.runId !== 'string' || !['running', 'ready', 'error'].includes(state.status) ||
        (state.error !== undefined && typeof state.error !== 'string')) throw new Error('Invalid daily state; inspect state.json.');
    return state;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
export async function dailyStatus(directory: string): Promise<DailyResult> {
  const pack = await readDailyPack(directory), state = await readState(directory);
  return { pack, reused: true, error: state?.status === 'running'
    ? 'Generation is running or was interrupted. Check the lock PID before recovery.' : state?.error };
}

/** Accepted prompt files are loaded verbatim. No writer sees another voice's output. */
export async function dailySeeds(sources: DailySources, day: string): Promise<{ channel: DailyChannel; seed: GenerationSeed }[]> {
  const rotation = Math.floor(Date.parse(day + 'T12:00:00Z') / 86400_000) % 3;
  const forecasters: VoiceId[] = ['forecast-positive', 'forecast-neutral', 'forecast-negative'];
  const buzzVoices: VoiceId[] = ['student', 'blogger', 'satirist'];
  const seeds = await Promise.all([
    seedFromWeather(sources.weather, forecasters[rotation], 'today'),
    seedFromHeadline(sources.headlines, 0),
    seedFromPacket(sources.buzz[0], buzzVoices[rotation]),
    seedFromWeather(sources.weather, 'reaction-positive'),
    seedFromWeather(sources.weather, forecasters[(rotation + 1) % 3], 'extended'),
    seedFromHeadline(sources.headlines, 1),
    seedFromPacket(sources.buzz[1], buzzVoices[(rotation + 1) % 3]),
    seedFromWeather(sources.weather, 'reaction-negative')
  ]);
  const channels: DailyChannel[] = ['Weather', 'Headlines', 'Buzz', 'Weather', 'Weather', 'Headlines', 'Buzz', 'Weather'];
  return seeds.map((seed, i) => ({ seed, channel: channels[i] }));
}

/** One automatic attempt per Helena launch-day, including failures. Manual force is explicit. */
export async function ensureDaily(
  directory: string, options: { force?: boolean; signal?: AbortSignal; progress?: (message: string) => void } = {},
  deps: DailyDependencies = dependencies
): Promise<DailyResult> {
  const signal = options.signal ?? new AbortController().signal;
  const progress = options.progress ?? (() => {});
  let previous: DailyPack | undefined;
  try {
    previous = await readDailyPack(directory);
    return await withPreviewLock(directory, async () => {
      // Re-read under the same lock used by history: concurrent launches cannot both spend calls.
      previous = await readDailyPack(directory);
      const day = dailyDay(deps.now());
      const existing = await readState(directory);
      if (!options.force && (existing?.day === day || previous?.day === day)) {
        return { pack: previous, reused: true, error: existing?.day === day
          ? existing.status === 'running' ? 'Earlier generation was interrupted; use manual refresh after checking its lock.' : existing.error
          : undefined };
      }
      signal.throwIfAborted();
      const state: DailyState = { version: 1, day, runId: randomUUID(), startedAt: deps.now().toISOString(), status: 'running' };
      // Persist the day BEFORE any network work so failures/relaunches don't hammer sources/models.
      await saveJson(join(directory, 'state.json'), state);
      try {
        progress('Preparing Sol 6.1 low');
        const writer = await deps.writer(signal); // Fail missing model/login setup before browser collection.
        signal.throwIfAborted();
        const sources = await deps.collect(signal, progress);
        signal.throwIfAborted();
        const archive = join(directory, 'sources', state.runId);
        await mkdir(archive, { recursive: true });
        await Promise.all([
          writeOnce(join(archive, 'weather.json'), sources.weather),
          writeOnce(join(archive, 'headlines.json'), sources.headlines),
          ...sources.buzz.map((packet, i) => writeOnce(join(archive, 'buzz-' + (i + 1) + '.json'), packet))
        ]);
        const plan = await dailySeeds(sources, day);
        signal.throwIfAborted();
        progress('Writing 8 passages with Sol 6.1 low');
        let completed = 0;
        const batch = await generateParallel(directory, plan.map(({ seed }) => ({ seed, writer })), () => {
          progress(`Writing passages: ${++completed}/8 complete`);
        });
        signal.throwIfAborted();
        const failed = batch.attempts.filter(a => a.status !== 'ready' || !a.passage);
        if (failed.length) throw new Error(`${failed.length}/8 passages failed; previous pack preserved. ` + failed.map(a => `#${a.attemptId}: ${a.error}`).join('; '));
        const pack = validateDailyPack({
          version: 1, id: state.runId, day, generatedAt: deps.now().toISOString(), model: writer.model, thinking: writer.thinking,
          entries: batch.attempts.map((a, i) => ({ channel: plan[i].channel, attemptId: a.attemptId,
            passage: { ...a.passage!, genre: 'Daily AI / ' + plan[i].channel } }))
        });
        await mkdir(join(directory, 'packs'), { recursive: true });
        await writeOnce(join(directory, 'packs', `${day}-${pack.id}.json`), pack);
        await saveJson(join(directory, 'current.json'), pack); // Only publish a complete, playable pack.
        previous = pack;
        await saveJson(join(directory, 'state.json'), { ...state, status: 'ready' });
        progress('Daily pack ready');
        return { pack, reused: false };
      } catch (error) {
        const message = cleanText(error instanceof Error ? error.message : String(error), 1200);
        await saveJson(join(directory, 'state.json'), { ...state, status: 'error', error: message });
        return { pack: previous, reused: false, error: message };
      }
    });
  } catch (error) {
    return { pack: previous, reused: true, error: cleanText(error instanceof Error ? error.message : String(error), 1200) };
  }
}

/** A play-through pins its pack, so a background refresh never replaces text mid-round. */
export class DailyDeck {
  private index = 0;
  constructor(readonly pack: DailyPack) {}
  current(): DailyEntry { return this.pack.entries[this.index]; }
  get position(): number { return this.index + 1; }
  next(): DailyEntry { this.index = (this.index + 1) % this.pack.entries.length; return this.current(); }
}
