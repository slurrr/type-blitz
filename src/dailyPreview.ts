import { Command, Option } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { collectReddit } from './daily/browser.js';
import { createPiWriter, DEFAULT_MODEL, DEFAULT_THINKING } from './daily/pi.js';
import { collectOnce, formatPacket, readPacket, sourceId, withPreviewLock } from './daily/preview.js';
import { formatAttempt, formatPromptTable, formatTable, generateParallel, generateSequential, getAttempt, listAttempts, markAttempt, migrateLegacy, readReviews, reviewAttempts, seedFromAttempt, seedFromPacket } from './daily/history.js';
import { RATINGS, THINKING_LEVELS, VOICES, type Rating, type VoiceId } from './daily/types.js';
import { comparisonVariants } from './daily/variants.js';
import { registerWeather } from './daily/weatherCli.js';
import { registerHeadlines } from './daily/headlinesCli.js';

const program = new Command()
  .name('daily-preview')
  .description('Standalone frozen-topic voice experiment with immutable numbered history. Never launches the game.')
  .option('--dir <path>', 'preview artifacts directory', process.env.TYPE_BLITZ_DAILY_DIR ?? join(homedir(), 'runs/type-blitz/daily-preview'));

function parseId(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('Attempt ID must be a positive integer.');
  return Number(value);
}

program.command('collect')
  .description('Freeze one Reddit topic; reuse it without network access unless --refresh is explicit')
  .option('--refresh', 'explicitly replace current context; archived attempts keep their own input')
  .action(async ({ refresh }) => {
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      console.log(formatPacket(await collectOnce(dir, () => collectReddit(), refresh)));
      console.log('\nFrozen source ready. Inspect it, then use generate. Collection never calls a model.');
    });
  });

program.command('migrate')
  .description('Import the original per-voice JSON files without changing them (safe to repeat)')
  .addOption(new Option('--execution <mode>', 'how the legacy calls were run').choices(['parallel', 'sequential', 'unknown']).default('unknown'))
  .action(async options => {
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      const attempts = await migrateLegacy(dir, options.execution);
      console.log(attempts.length ? formatTable(attempts, await readReviews(dir)) : 'No new legacy attempts to import.');
    });
  });

program.command('list')
  .description('Lookup table of ALL attempts, including bad, failed and interrupted ones; no network')
  .option('--by-prompt', 'quality counts by exact prompt + model + thinking, including bad and unreviewed results')
  .action(async options => {
    const { dir } = program.opts();
    const format = options.byPrompt ? formatPromptTable : formatTable;
    console.log(format(await listAttempts(dir), await readReviews(dir)));
  });

program.command('show')
  .description('Show a historical attempt, or current context and latest matching attempts; no network')
  .argument('[id]', 'immutable attempt ID, e.g. 001')
  .option('--prompt', 'also print the exact system/voice instructions used')
  .option('--input', 'also print the exact user/source input used')
  .option('--json', 'print the complete historical record (requires ID)')
  .action(async (id: string | undefined, options) => {
    const { dir } = program.opts();
    const reviews = await readReviews(dir);
    if (id) {
      const attempt = await getAttempt(dir, parseId(id));
      if (options.json) { console.log(JSON.stringify(attempt, null, 2)); return; }
      console.log(formatAttempt(attempt, reviews));
      if (options.prompt) console.log('\nEXACT SYSTEM PROMPT\n' + attempt.request.systemPrompt);
      if (options.input) console.log('\nEXACT USER INPUT\n' + attempt.request.userPrompt);
    } else {
      if (options.prompt || options.input || options.json) throw new Error('Choose an attempt ID to inspect its exact prompt/input/record.');
      const packet = await readPacket(dir);
      console.log(formatPacket(packet));
      const attempts = (await listAttempts(dir)).filter(a => a.sourceId === sourceId(packet));
      for (const voice of Object.keys(VOICES) as VoiceId[]) {
        const latest = attempts.filter(a => a.voice === voice).at(-1);
        if (latest) console.log(formatAttempt(latest, reviews));
      }
    }
  });

program.command('mark')
  .description('Mark good/mid/bad, or clear a mark with unrated; notes never change the generation record')
  .argument('<id>', 'attempt ID')
  .argument('<rating>', 'good, mid, bad, or unrated')
  .option('--note <text>', 'review note (existing note is preserved when omitted)')
  .action(async (id: string, rating: string, options) => {
    if (rating !== 'unrated' && !RATINGS.includes(rating as Rating)) throw new Error('Rating must be good, mid, bad or unrated.');
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      await markAttempt(dir, parseId(id), rating === 'unrated' ? undefined : rating as Rating, options.note);
      console.log(formatAttempt(await getAttempt(dir, parseId(id)), await readReviews(dir)));
    });
  });

program.command('review')
  .description('Read good passages, optionally followed by mid; bad/unrated/errors are never included')
  .option('--include-mid', 'include mid after good')
  .action(async options => {
    const { dir } = program.opts();
    const reviews = await readReviews(dir);
    const attempts = reviewAttempts(await listAttempts(dir), reviews, options.includeMid);
    if (!attempts.length) console.log('No marked passages in this review selection. Use list and mark first.');
    for (const attempt of attempts) console.log(formatAttempt(attempt, reviews));
  });

program.command('compare')
  .description('CONCURRENT comparison of each archived prompt across model/effort variants; generates new attempts')
  .argument('<ids>', 'source attempt IDs, e.g. 001 or 001,002,003')
  .option('--model <id>', 'one physical openai-codex model')
  .option('--thinking <levels>', 'comma-separated efforts for --model (default: low,xhigh)')
  .option('--variant <model:thinking>', 'repeat for mixed-model comparisons; replaces --model/--thinking',
    (value: string, previous: string[]) => [...previous, value], [])
  .action(async (idsText: string, options) => {
    const ids = idsText.split(',').map(parseId);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate source IDs would create accidental extra calls.');
    const variants = comparisonVariants(options);
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      const preparationStart = performance.now();
      const seeds = await Promise.all(ids.map(async id => seedFromAttempt(await getAttempt(dir, id))));
      const writers = await Promise.all(variants.map(v => createPiWriter(v.model, v.thinking)));
      const reviews = await readReviews(dir);
      const jobs = seeds.flatMap(seed => writers.map(writer => ({ seed, writer })));
      console.log(`Comparing ${variants.map(v => v.model + ':' + v.thinking).join(' / ')} CONCURRENTLY on archived prompts ${ids.join(', ')}: ${jobs.length} calls. No Reddit requests.`);
      const batch = await generateParallel(dir, jobs, attempt => console.log(formatAttempt(attempt, reviews)));
      console.log(`\nComparison wall time: ${(batch.wallMs / 1000).toFixed(2)} s; with preparation: ${((performance.now() - preparationStart) / 1000).toFixed(2)} s.`);
      if (batch.attempts.some(a => a.status !== 'ready')) process.exitCode = 1;
    });
  });

program.command('generate')
  .description('Append new attempts, one call at a time. Never replaces history or fetches Reddit.')
  .argument('[voice]', 'student, blogger, satirist, or all (uses current prompt files)', 'all')
  .option('--from <ids>', 'replay exact saved prompts AND input, e.g. 001,002,003; ignores current prompt/context files')
  .option('--model <id>', 'physical openai-codex model (no automatic fallback)', DEFAULT_MODEL)
  .addOption(new Option('--thinking <level>', 'reasoning effort, verified on outgoing payload').choices([...THINKING_LEVELS]).default(DEFAULT_THINKING))
  .action(async (voice: string, options) => {
    if (voice !== 'all' && !Object.hasOwn(VOICES, voice)) throw new Error('Voice must be student, blogger, satirist, or all.');
    if (options.from && voice !== 'all') throw new Error('Choose a voice OR --from attempt IDs, not both.');
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      const preparationStart = performance.now();
      let seeds;
      if (options.from) {
        const ids = String(options.from).split(',').map(parseId);
        if (new Set(ids).size !== ids.length) throw new Error('Duplicate --from IDs would create accidental extra calls.');
        seeds = await Promise.all(ids.map(async id => seedFromAttempt(await getAttempt(dir, id))));
      } else {
        const packet = await readPacket(dir);
        const voices = voice === 'all' ? Object.keys(VOICES) as VoiceId[] : [voice as VoiceId];
        seeds = await Promise.all(voices.map(id => seedFromPacket(packet, id)));
      }
      console.log(`Preparing ${seeds.length} SEQUENTIAL call(s); every result gets a new ID. No Reddit requests.`);
      const writer = await createPiWriter(options.model, options.thinking);
      const reviews = await readReviews(dir);
      const batch = await generateSequential(dir, seeds, writer, attempt => console.log(formatAttempt(attempt, reviews)));
      console.log(`\nGeneration batch wall time: ${(batch.wallMs / 1000).toFixed(2)} s; with preparation: ${((performance.now() - preparationStart) / 1000).toFixed(2)} s.`);
      if (batch.attempts.some(a => a.status !== 'ready')) process.exitCode = 1;
    });
  });

registerWeather(program);
registerHeadlines(program);

program.parseAsync().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
