import { Command, Option } from 'commander';
import { formatAttempt, generateParallel, generateSequential, listAttempts, readReviews } from './history.js';
import { createPiWriter } from './pi.js';
import { sourceId, withPreviewLock } from './preview.js';
import { THINKING_LEVELS, WEATHER_VOICES, type VoiceId } from './types.js';
import { addWeatherReport, collectWeatherOnce, formatWeather, readWeather, seedFromWeather, WEATHER_MODES } from './weather.js';

export function registerWeather(program: Command): void {
  const weather = program.command('weather').description('Isolated Helena weather experiments; independent of Reddit context');
  weather.command('collect')
    .description('Freeze the public NWS forecast (two requests); reuse until explicit refresh. No model calls.')
    .option('--refresh', 'explicitly fetch a new forecast; retain dated user reports')
    .action(async options => {
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => console.log(formatWeather(await collectWeatherOnce(dir, options.refresh))));
    });
  weather.command('note')
    .description('Append user-reported conditions, explicitly NOT official weather; no network')
    .argument('<text>', 'what it feels like outside, in your own words')
    .action(async report => {
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => console.log(formatWeather(await addWeatherReport(dir, report))));
    });
  weather.command('show')
    .description('Inspect the frozen weather input and matching attempts; no network')
    .action(async () => {
      const { dir } = program.opts();
      const packet = await readWeather(dir);
      console.log(formatWeather(packet));
      const reviews = await readReviews(dir);
      for (const attempt of (await listAttempts(dir)).filter(a => a.sourceId === sourceId(packet))) {
        console.log(formatAttempt(attempt, reviews));
      }
    });
  weather.command('generate')
    .description('Generate one weather passage per selected voice; defaults to sequential, never fetches weather')
    .argument('[voice]', 'weatherman, weather-friend, student, blogger, satirist, or all (five calls)', 'weatherman')
    .addOption(new Option('--mode <mode>', 'forecast today, upcoming periods, or relatable commentary').choices([...WEATHER_MODES]).default('today'))
    .option('--model <id>', 'explicit physical openai-codex model; required unless --dry-run')
    .addOption(new Option('--thinking <level>', 'explicit effort; required unless --dry-run').choices([...THINKING_LEVELS]))
    .option('--dry-run', 'print exact prompts/input only; no model, credentials or numbered attempts')
    .option('--parallel', 'explicitly run selected voices concurrently instead of sequentially')
    .action(async (voice: string, options) => {
      if (voice !== 'all' && !Object.hasOwn(WEATHER_VOICES, voice)) throw new Error('Unknown weather voice.');
      if (!options.dryRun && (!options.model || !options.thinking)) {
        throw new Error('Choose --model and --thinking explicitly, or inspect with --dry-run first.');
      }
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => {
        const start = performance.now();
        const packet = await readWeather(dir);
        const voices = voice === 'all' ? Object.keys(WEATHER_VOICES) as VoiceId[] : [voice as VoiceId];
        const seeds = await Promise.all(voices.map(id => seedFromWeather(packet, id, options.mode)));
        if (options.dryRun) {
          for (const seed of seeds) console.log(`\n${seed.voice} / ${options.mode}\n\nSYSTEM\n${seed.request.systemPrompt}\n\nUSER\n${seed.request.userPrompt}`);
          console.log(`\nDry run: ${seeds.length} prompt(s); zero model calls and zero attempts.`);
          return;
        }
        const writer = await createPiWriter(options.model, options.thinking);
        const reviews = await readReviews(dir);
        const show = (attempt: Parameters<typeof formatAttempt>[0]) => console.log(formatAttempt(attempt, reviews));
        console.log(`${seeds.length} ${options.parallel ? 'CONCURRENT' : 'SEQUENTIAL'} weather call(s). Frozen input only; no collection.`);
        const batch = options.parallel
          ? await generateParallel(dir, seeds.map(seed => ({ seed, writer })), show)
          : await generateSequential(dir, seeds, writer, show);
        console.log(`\nWeather wall time: ${(batch.wallMs / 1000).toFixed(2)} s; with preparation: ${((performance.now() - start) / 1000).toFixed(2)} s.`);
        if (batch.attempts.some(a => a.status !== 'ready')) process.exitCode = 1;
      });
    });
}
