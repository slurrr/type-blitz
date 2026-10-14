import { Command, Option } from 'commander';
import { formatAttempt, generateAttempt, generateParallel, listAttempts, readReviews } from './history.js';
import { createPiWriter } from './pi.js';
import { sourceId, withPreviewLock } from './preview.js';
import { comparisonVariants, type WriterVariant } from './variants.js';
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
    .description('Generate one weather passage per voice/model variant; defaults to sequential, never fetches weather')
    .argument('[voice]', 'forecast-negative, forecast-positive, reaction-negative, reaction-positive, or all (four voices)', 'forecast-positive')
    .addOption(new Option('--mode <mode>', 'auto selects today for presenters and feel for reactions').choices(['auto', ...WEATHER_MODES]).default('auto'))
    .option('--model <id>', 'single physical openai-codex model; pair with --thinking')
    .addOption(new Option('--thinking <level>', 'explicit effort for --model; use --variant for a matrix').choices([...THINKING_LEVELS]))
    .option('--variant <model:thinking>', 'repeat for multiple models; replaces --model/--thinking',
      (value: string, previous: string[]) => [...previous, value], [])
    .option('--dry-run', 'print exact prompts/input only; no model, credentials or numbered attempts')
    .option('--parallel', 'explicitly run selected voices concurrently instead of sequentially')
    .action(async (voice: string, options) => {
      if (voice !== 'all' && !Object.hasOwn(WEATHER_VOICES, voice)) throw new Error('Unknown weather voice.');
      let variants: WriterVariant[] = [];
      if (options.variant.length) {
        variants = comparisonVariants(options);
      } else if (options.model && options.thinking) {
        variants = [{ model: options.model, thinking: options.thinking }];
      } else if (!options.dryRun || options.model || options.thinking) {
        throw new Error('Choose --model and --thinking explicitly, repeat --variant, or inspect with --dry-run first.');
      }
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => {
        const start = performance.now();
        const packet = await readWeather(dir);
        const voices = voice === 'all' ? Object.keys(WEATHER_VOICES) as VoiceId[] : [voice as VoiceId];
        const seeds = await Promise.all(voices.map(id => seedFromWeather(packet, id, options.mode)));
        if (options.dryRun) {
          for (const seed of seeds) console.log(`\n${seed.voice} / ${seed.source.title}\n\nSYSTEM\n${seed.request.systemPrompt}\n\nUSER\n${seed.request.userPrompt}`);
          if (variants.length) console.log(`Planned matrix: ${seeds.length} voices x ${variants.length} variants = ${seeds.length * variants.length} calls (${options.parallel ? 'parallel' : 'sequential'}).\n${variants.map(v => v.model + ':' + v.thinking).join(' / ')}`);
          console.log(`\nDry run: ${seeds.length} prompt(s); zero model calls and zero attempts.`);
          return;
        }
        const writers = await Promise.all(variants.map(v => createPiWriter(v.model, v.thinking)));
        const jobs = seeds.flatMap(seed => writers.map(writer => ({ seed, writer })));
        const reviews = await readReviews(dir);
        const show = (attempt: Parameters<typeof formatAttempt>[0]) => console.log(formatAttempt(attempt, reviews));
        console.log(`${jobs.length} ${options.parallel ? 'CONCURRENT' : 'SEQUENTIAL'} weather call(s): ${seeds.length} voices x ${writers.length} variants. Frozen input only; no collection.`);
        let batch;
        if (options.parallel) {
          batch = await generateParallel(dir, jobs, show);
        } else {
          const batchStart = performance.now();
          const attempts = [];
          for (const { seed, writer } of jobs) {
            const attempt = await generateAttempt(dir, seed, writer);
            attempts.push(attempt);
            show(attempt);
          }
          batch = { attempts, wallMs: performance.now() - batchStart };
        }
        console.log(`\nWeather wall time: ${(batch.wallMs / 1000).toFixed(2)} s; with preparation: ${((performance.now() - start) / 1000).toFixed(2)} s.`);
        if (batch.attempts.some(a => a.status !== 'ready')) process.exitCode = 1;
      });
    });
}
