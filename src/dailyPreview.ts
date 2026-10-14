import { Command, Option } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { collectReddit } from './daily/browser.js';
import { createPiWriter, DEFAULT_MODEL, DEFAULT_THINKING } from './daily/pi.js';
import { collectOnce, formatPacket, formatSample, generateSample, readPacket, readSample, sourceId, withPreviewLock } from './daily/preview.js';
import { THINKING_LEVELS, VOICES, type VoiceId } from './daily/types.js';

const program = new Command()
  .name('daily-preview')
  .description('Standalone frozen-topic / three-voice experiment. Never launches the game.')
  .option('--dir <path>', 'preview artifacts directory', process.env.TYPE_BLITZ_DAILY_DIR ?? join(homedir(), 'runs/type-blitz/daily-preview'));

program.command('collect')
  .description('Freeze one Reddit topic; reuse it without network access unless --refresh is explicit')
  .option('--refresh', 'explicitly replace the frozen packet (existing samples become stale)')
  .action(async ({ refresh }) => {
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      console.log(formatPacket(await collectOnce(dir, () => collectReddit(), refresh)));
      console.log('\nFrozen source ready. Inspect it, then use generate. Collection never calls a model.');
    });
  });

program.command('show')
  .description('Print the frozen input and current matching samples; no browser/model calls')
  .action(async () => {
    const { dir } = program.opts();
    const packet = await readPacket(dir);
    console.log(formatPacket(packet));
    for (const voice of Object.keys(VOICES) as VoiceId[]) {
      const sample = await readSample(dir, voice);
      if (sample?.sourceId === sourceId(packet)) console.log(formatSample(sample));
      else if (sample) console.log(`\n${voice}: sample belongs to a different frozen packet; not shown.`);
    }
  });

program.command('generate')
  .description('Make one independent call per selected voice, using ONLY the existing frozen input')
  .argument('[voice]', 'student, blogger, satirist, or all', 'all')
  .option('--replace', 'explicitly overwrite the selected existing samples')
  .option('--model <id>', 'physical openai-codex model (no automatic fallback)', DEFAULT_MODEL)
  .addOption(new Option('--thinking <level>', 'reasoning effort, verified on the outgoing payload').choices([...THINKING_LEVELS]).default(DEFAULT_THINKING))
  .action(async (voice: string, options) => {
    if (voice !== 'all' && !Object.hasOwn(VOICES, voice)) throw new Error('Voice must be student, blogger, satirist, or all.');
    const voices = voice === 'all' ? Object.keys(VOICES) as VoiceId[] : [voice as VoiceId];
    const { dir } = program.opts();
    await withPreviewLock(dir, async () => {
      const packet = await readPacket(dir); // Missing input fails; generation NEVER calls the collector.
      for (const id of voices) {
        if (!options.replace && await readSample(dir, id)) throw new Error(`${id}.json exists; select one voice and use --replace to rerun.`);
      }
      console.log(`Frozen topic: ${packet.post.title}\nSource: ${sourceId(packet).slice(0, 12)}\nPreparing ${voices.length} independent writer call(s); no Reddit requests.`);
      const writer = await createPiWriter(options.model, options.thinking);
      const results = await Promise.allSettled(voices.map(id => generateSample(dir, packet, id, writer, options.replace)));
      for (const result of results) {
        if (result.status === 'fulfilled') {
          console.log(formatSample(result.value));
          if (result.value.status !== 'ready') process.exitCode = 1;
        } else {
          console.error(result.reason instanceof Error ? result.reason.message : String(result.reason));
          process.exitCode = 1;
        }
      }
    });
  });

program.parseAsync().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
