import { localTimestamp } from './time.js';
import { spawn } from 'node:child_process';
import { mkdtemp, open, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { FEED_URL, extractComments, makePacket, selectPost } from './reddit.js';
import type { SourcePacket } from './types.js';

export type BrowserCommand = (args: string[]) => Promise<Record<string, unknown>>;

export const browserCommand: BrowserCommand = async (args) => {
  // bb-browser exits before large piped stdout has fully drained. A temporary regular
  // file makes Node's stdout writes synchronous; it is deleted even on failure.
  const temporary = await mkdtemp(join(tmpdir(), 'type-blitz-browser-'));
  const path = join(temporary, 'response.json');
  const output = await open(path, 'wx', 0o600);
  try {
    let stderr = '';
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn('bb-browser', ['--json', ...args], {
        stdio: ['ignore', output.fd, 'pipe'], timeout: 30_000
      });
      child.stderr!.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
      child.on('error', reject);
      child.on('close', resolve);
    });
    if ((await stat(path)).size > 5 * 1024 * 1024) throw new Error('Browser response exceeds 5 MB; stopping.');
    const stdout = await readFile(path, 'utf8');
    if (!stdout.trim()) throw new Error('bb-browser produced no JSON: ' + stderr);
    const envelope = JSON.parse(stdout);
    if (envelope.success !== true || code !== 0) throw new Error('bb-browser: ' + (envelope.error ?? stderr ?? 'request failed'));
    return envelope.data ?? {};
  } finally {
    await output.close();
    await rm(temporary, { recursive: true, force: true });
  }
};

/** Wait for the original navigation. These are local DOM reads, never HTTP retries. */
export async function readFeedDocument(command: BrowserCommand, tab: string, feedUrl = FEED_URL): Promise<unknown> {
  const deadline = Date.now() + 10_000;
  const script = `(() => {
    if (location.href !== ${JSON.stringify(feedUrl)} || document.readyState !== 'complete' || !document.body?.innerText?.trim()) {
      return { loading: true };
    }
    try { return { loading: false, value: JSON.parse(document.body.innerText) }; }
    catch { throw new Error('Reddit feed is not JSON (possible block/login page); stopping without retry'); }
  })()`;
  while (Date.now() < deadline) {
    try {
      const response = await command(['eval', script, '--tab', tab]);
      const result = response.result as { loading?: boolean; value?: unknown } | undefined;
      if (result?.loading === false) return result.value;
      if (result?.loading !== true) throw new Error('Unexpected browser readiness result.');
    } catch (error) {
      // Chromium destroys the old about:blank context when the navigation commits.
      if (!(error instanceof Error) || !/Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
    }
    await delay(200);
  }
  throw new Error('Reddit feed did not become ready in 10 seconds; no reload or HTTP retry.');
}

/** Exactly one feed navigation and one bounded comments fetch. No LLM, HTTP retries or tab guessing. */
export async function collectReddit(command: BrowserCommand = browserCommand): Promise<SourcePacket> {
  const opened = await command(['open', FEED_URL]);
  const tabId = opened.tabId;
  if (typeof tabId !== 'string' && typeof tabId !== 'number') {
    throw new Error('Browser did not return a tab ID; cannot safely target/close its tab.');
  }
  const tab = String(tabId);
  try {
    const post = selectPost(await readFeedDocument(command, tab));
    const path = new URL(post.permalink).pathname.replace(/\/$/, '') + '.json?sort=top&limit=20&depth=2&raw_json=1';
    const script = `(async () => {
      const r = await fetch(${JSON.stringify(path)}, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("Reddit HTTP " + r.status + "; stopping without retry");
      return await r.json();
    })()`;
    const thread = await command(['eval', script, '--tab', tab]);
    return makePacket(post, extractComments(thread.result, post.id), localTimestamp());
  } finally {
    await command(['close', '--tab', tab]);
  }
}
