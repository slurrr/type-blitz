import { fork, type ChildProcess } from 'node:child_process';
import { cleanText } from './reddit.js';
import { dailyDirectory, dailyStatus, validateDailyPack, type DailyPack, type DailyResult } from './session.js';

export class DailyClient {
  pack?: DailyPack;
  busy = false;
  message = 'Checking daily pack';
  error?: string;
  private child?: ChildProcess;
  private pending?: Promise<DailyResult>;
  private disposed = false;
  constructor(readonly directory = dailyDirectory(), private changed: () => void = () => {}) {}

  async load(): Promise<void> {
    try {
      const result = await dailyStatus(this.directory);
      this.pack = result.pack;
      this.error = result.error;
      this.message = this.error ? 'Daily needs attention' : this.pack ? 'Saved daily pack ready' : 'No saved daily pack';
    } catch (error) {
      this.error = cleanText(error instanceof Error ? error.message : String(error), 1200);
      this.message = 'Daily cache needs attention';
    }
    if (!this.disposed) this.changed();
  }

  run(force = false): Promise<DailyResult> {
    if (this.pending) return this.pending; // Repeated R presses never enqueue more spending.
    if (this.disposed) return Promise.resolve({ pack: this.pack, reused: true, error: 'Daily client closed.' });
    this.busy = true;
    this.error = undefined;
    this.message = force ? 'Refreshing daily sources and passages' : 'Checking today\'s daily pack';
    this.changed();
    this.pending = this.runWorker(force).finally(() => {
      this.busy = false;
      this.pending = undefined;
      if (!this.disposed) this.changed();
    });
    return this.pending;
  }

  private async runWorker(force: boolean): Promise<DailyResult> {
    await this.load();
    if (this.disposed) return { pack: this.pack, reused: true };
    this.message = force ? 'Refreshing daily sources and passages' : 'Checking today\'s daily pack';
    this.changed();
    return new Promise(resolve => {
      let finished = false;
      const finish = (result: DailyResult) => {
        if (finished) return;
        finished = true;
        this.pack = result.pack ?? this.pack;
        this.error = result.error;
        this.message = result.error ? 'Daily generation unavailable' : result.reused ? 'Saved daily pack ready' : 'Fresh daily pack ready';
        resolve(result);
      };
      try {
        // Separate process: SDK loading / provider output cannot block or corrupt the terminal renderer.
        const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
        const child = fork(new URL('./worker' + extension, import.meta.url), [this.directory, force ? 'refresh' : 'ensure'], {
          // Do not inherit eval/input-type/inspector flags from the caller. Resolve tsx
          // relative to this module, so source-mode launches also work outside the repo.
          execArgv: extension === '.ts' ? ['--import', import.meta.resolve('tsx')] : [],
          stdio: ['ignore', 'ignore', 'pipe', 'ipc']
        });
        this.child = child;
        let stderr = '';
        child.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
        child.on('message', (message: { type?: string; message?: unknown; result?: DailyResult }) => {
          if (message?.type === 'progress' && typeof message.message === 'string') {
            this.message = cleanText(message.message, 200);
            if (!this.disposed) this.changed();
          } else if (message?.type === 'result' && message.result) {
            try {
              const result = message.result;
              if (result.pack) validateDailyPack(result.pack);
              finish({ ...result, error: result.error ? cleanText(result.error, 1200) : undefined });
            } catch (error) { finish({ pack: this.pack, reused: true, error: String(error) }); }
          }
        });
        child.once('error', error => finish({ pack: this.pack, reused: true, error: cleanText(error.message) }));
        child.once('exit', code => {
          if (this.child === child) this.child = undefined;
          finish({ pack: this.pack, reused: true, error: cleanText(`Daily worker exited (${code}): ${stderr}`, 1200) });
        });
      } catch (error) {
        finish({ pack: this.pack, reused: true, error: cleanText(String(error), 1200) });
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    // Disconnect signals cancellation. The worker aborts model calls and closes only its owned tabs.
    if (this.child?.connected) this.child.disconnect();
  }
}
