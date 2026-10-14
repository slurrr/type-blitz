import { Command, Option } from 'commander';
import { collectHeadlines } from './headlineBrowser.js';
import { collectHeadlinesOnce, formatHeadlines, headlineSourceId, readHeadlines, seedFromHeadline } from './headlines.js';
import { formatAttempt, generateParallel, generateSequential, listAttempts, readReviews } from './history.js';
import { createPiWriter } from './pi.js';
import { withPreviewLock } from './preview.js';
import { THINKING_LEVELS } from './types.js';

export function registerHeadlines(program: Command): void {
  const headlines = program.command('headlines').description('Separate frozen news/reporting + reaction preview; no game integration');
  headlines.command('collect')
    .description('Find two current external stories, read publisher context and discussions; reuse until --refresh')
    .option('--refresh', 'explicitly replace the current headline packet; never rewrites attempts')
    .action(async options => {
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => console.log(formatHeadlines(await collectHeadlinesOnce(dir, collectHeadlines, options.refresh))));
    });
  headlines.command('show')
    .description('Inspect frozen reporting, separate public reactions, and matching attempts; no network')
    .option('--json', 'show the complete frozen source packet')
    .action(async options => {
      const { dir } = program.opts();
      const packet = await readHeadlines(dir);
      if (options.json) { console.log(JSON.stringify(packet, null, 2)); return; }
      console.log(formatHeadlines(packet));
      const ids = new Set(packet.stories.map(s => headlineSourceId(packet, s)));
      const reviews = await readReviews(dir);
      for (const attempt of (await listAttempts(dir)).filter(a => ids.has(a.sourceId))) console.log(formatAttempt(attempt, reviews));
    });
  headlines.command('generate')
    .description('One personal passage per selected story; Sol 6.1 low by default, no collection or rewrites')
    .argument('[story]', '1, 2 or all (two calls)', 'all')
    .option('--model <id>', 'physical openai-codex model', 'gpt-6.1-sol')
    .addOption(new Option('--thinking <level>', 'reasoning effort').choices([...THINKING_LEVELS]).default('low'))
    .option('--parallel', 'run both stories concurrently instead of sequentially')
    .option('--dry-run', 'print exact requests; no credentials, model calls or attempts')
    .action(async (story: string, options) => {
      if (!['1', '2', 'all'].includes(story)) throw new Error('Choose headline 1, 2 or all.');
      const { dir } = program.opts();
      await withPreviewLock(dir, async () => {
        const start = performance.now();
        const packet = await readHeadlines(dir);
        const seeds = await Promise.all((story === 'all' ? [0, 1] : [Number(story) - 1]).map(i => seedFromHeadline(packet, i)));
        console.log(`${options.model} / ${options.thinking}: ${seeds.length} ${options.parallel ? 'CONCURRENT' : 'SEQUENTIAL'} headline call(s) planned. Frozen input only.`);
        if (options.dryRun) {
          for (const seed of seeds) console.log(`\n${seed.source.title}\n\nSYSTEM\n${seed.request.systemPrompt}\n\nUSER\n${seed.request.userPrompt}`);
          console.log('Dry run: zero model calls and zero attempts.');
          return;
        }
        const writer = await createPiWriter(options.model, options.thinking), reviews = await readReviews(dir);
        const show = (a: Parameters<typeof formatAttempt>[0]) => console.log(`\nSTORY: ${a.source.title}` + formatAttempt(a, reviews));
        const batch = options.parallel ? await generateParallel(dir, seeds.map(seed => ({ seed, writer })), show)
          : await generateSequential(dir, seeds, writer, show);
        console.log(`\nHeadlines wall time: ${(batch.wallMs / 1000).toFixed(2)} s; with preparation: ${((performance.now() - start) / 1000).toFixed(2)} s.`);
        if (batch.attempts.some(a => a.status !== 'ready')) process.exitCode = 1;
      });
    });
}
