import { ensureDaily } from './session.js';

const controller = new AbortController();
const cancel = () => controller.abort(new Error('Daily generation cancelled; previous pack preserved.'));
process.on('disconnect', cancel);
process.on('SIGTERM', cancel);
process.on('SIGINT', cancel);
process.on('message', message => {
  if ((message as { type?: string })?.type === 'cancel') cancel();
});
const send = (message: unknown) => new Promise<void>(resolve => {
  if (!process.connected || !process.send) return resolve();
  process.send(message, () => resolve());
});
try {
  const directory = process.argv[2];
  if (!directory) throw new Error('Daily worker requires a runtime directory.');
  const result = await ensureDaily(directory, {
    force: process.argv[3] === 'refresh', signal: controller.signal,
    progress: message => { void send({ type: 'progress', message }); }
  });
  await send({ type: 'result', result });
} catch (error) {
  await send({ type: 'result', result: { reused: true, error: error instanceof Error ? error.message : String(error) } });
} finally {
  if (process.connected) process.disconnect();
}
