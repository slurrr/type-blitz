import type { Command } from 'commander';
import { createServer, type IncomingMessage } from 'node:http';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { homedir, hostname, networkInterfaces } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { promptId } from './history.js';
import { renderAttemptHtml, renderSavedDataHtml } from './requestView.js';
import { renderReviewPage, REVIEW_SCRIPT, REVIEW_KINDS, type ReviewKind, type ReviewFile } from './reviewShell.js';
import type { Attempt, Reviews } from './types.js';
import { displayTimestamp } from './time.js';

export interface ReviewServerOptions {
  dailyDirectory: string;
  previewDirectory: string;
  allowedHosts?: string[];
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ROOT_FILES = new Set(['current.json', 'state.json', 'reviews.json', 'context.json', 'weather-context.json', 'headlines-context.json', 'student.json', 'blogger.json', 'satirist.json']);
const ATTEMPT_FILE = /^(\d{3,})-([a-z][a-z-]*)(\.pending)?\.json$/;

/** Only known archive areas, regular files, and at most one source-run directory. No arbitrary file route. */
export async function reviewFiles(directory: string, kind: ReviewKind): Promise<ReviewFile[]> {
  try { directory = await realpath(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const scan = async (subdir: string): Promise<string[]> => {
    try {
      const path = join(directory, subdir);
      if (await realpath(path) !== path || !(await lstat(path)).isDirectory()) return [];
      const entries = await readdir(path, { withFileTypes: true });
      return entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => subdir ? subdir + '/' + e.name : e.name);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  };
  let keys: string[];
  if (kind === 'state') keys = (await scan('')).filter(k => ROOT_FILES.has(k));
  else if (kind === 'sources') {
    try {
      const path = join(directory, 'sources');
      if (await realpath(path) !== path || !(await lstat(path)).isDirectory()) return [];
      const runs = await readdir(path, { withFileTypes: true });
      keys = (await Promise.all(runs.filter(e => e.isDirectory() && /^[\da-f-]{36}$/.test(e.name))
        .map(e => scan('sources/' + e.name)))).flat();
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') keys = []; else throw error; }
  } else keys = await scan(kind);
  if (kind === 'attempts') {
    const names = new Set(keys);
    keys = keys.filter(k => ATTEMPT_FILE.test(k.slice('attempts/'.length)) &&
      (!k.endsWith('.pending.json') || !names.has(k.replace('.pending.json', '.json'))));
  }
  const files: ReviewFile[] = [];
  for (const key of keys) {
    try { files.push({ key, label: key, modified: (await lstat(join(directory, key))).mtimeMs }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return files.sort((a, b) => kind === 'attempts'
    ? Number(b.key.match(/\d+/)![0]) - Number(a.key.match(/\d+/)![0])
    : b.modified - a.modified || a.key.localeCompare(b.key));
}

async function readSaved(directory: string, key: string, parse = true): Promise<{ text: string; value: unknown }> {
  const root = await realpath(directory), path = join(root, key);
  // Recheck containment and symlinks even after listing; do not follow links outside this archive.
  const actual = await realpath(path), rel = relative(root, actual);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || actual !== path || !(await lstat(path)).isFile()) {
    throw new Error('Only regular files inside the selected archive can be viewed.');
  }
  if ((await lstat(path)).size > 128_000) throw new Error('Saved record exceeds the 128 KB limit.');
  const text = await readFile(path, 'utf8');
  if (text.length > 128_000) throw new Error('Saved record exceeds the 128 KB limit.');
  return { text, value: parse ? JSON.parse(text) : undefined };
}
function asAttempt(value: unknown, key: string): Attempt {
  const a = value as Attempt | null;
  const match = ATTEMPT_FILE.exec(key.slice('attempts/'.length));
  if (!a || !match || a.attemptId !== Number(match[1]) || a.voice !== match[2] ||
      !Number.isSafeInteger(a.attemptId) || a.attemptId < 1 || !['pending', 'ready', 'error'].includes(a.status) ||
      typeof a.request?.systemPrompt !== 'string' || typeof a.request?.userPrompt !== 'string' ||
      typeof a.label !== 'string' || typeof a.source?.title !== 'string' || a.promptId !== promptId(a.request)) {
    throw new Error('Invalid archived attempt; inspect its saved JSON on disk.');
  }
  return a;
}

/** Read-only HTTP adapter; existing CLI HTML renderer is reused byte-for-byte. */
export function createReviewServer(options: ReviewServerOptions) {
  const directories = { daily: resolve(options.dailyDirectory), preview: resolve(options.previewDirectory) };
  const hosts = new Set(['localhost', '127.0.0.1', '::1', hostname(),
    ...Object.values(networkInterfaces()).flatMap(entries => entries?.map(e => e.address) ?? []),
    ...(options.allowedHosts ?? [])].map(h => h.toLowerCase().replace(/\.$/, '')));
  // Cache only picker labels, not rendered content; changes on disk remain visible on selection/reload.
  const labels = new Map<string, { modified: number; label: string }>();
  function validRequest(req: IncomingMessage): boolean {
    try {
      const host = new URL('http://' + req.headers.host);
      if (host.username || host.password || host.pathname !== '/' || host.search || host.hash ||
          !hosts.has(host.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')) || Number(host.port || 80) !== req.socket.localPort) return false;
      if (req.headers.origin && req.headers.origin !== host.origin) return false;
      return req.headers['sec-fetch-site'] !== 'cross-site' || req.headers['sec-fetch-mode'] === 'navigate';
    } catch { return false; }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const send = (status: number, type: string, body: string) => {
      res.statusCode = status; res.setHeader('Content-Type', type + '; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!validRequest(req)) { send(403, 'text/plain', 'Host/origin not allowed.'); return; }
    if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, HEAD'); send(405, 'text/plain', 'Read-only viewer.'); return; }
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; frame-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'");
    try {
      const url = new URL(req.url ?? '/', 'http://' + req.headers.host);
      if (url.pathname === '/review.js') { send(200, 'text/javascript', REVIEW_SCRIPT); return; }
      if (url.pathname !== '/' && url.pathname !== '/view') { send(404, 'text/plain', 'Not found.'); return; }
      const archive = url.searchParams.get('archive') ?? 'daily';
      if (archive !== 'daily' && archive !== 'preview') { send(400, 'text/plain', 'Unknown archive.'); return; }
      const kind = url.searchParams.get('kind') ?? 'attempts';
      if (!Object.hasOwn(REVIEW_KINDS, kind)) { send(400, 'text/plain', 'Unknown record kind.'); return; }
      const directory = directories[archive];
      const files = await reviewFiles(directory, kind as ReviewKind);
      const requested = url.searchParams.get('file');
      const selected = requested ? files.find(f => f.key === requested) ?? (kind === 'attempts' && requested.endsWith('.pending.json')
        ? files.find(f => f.key === requested.replace('.pending.json', '.json')) : undefined) : files[0];
      if (requested && !selected) { send(404, 'text/plain', 'Saved file is no longer listed. Reload the viewer without its file parameter.'); return; }
      if (url.pathname === '/') {
        for (const file of files) {
          const cacheKey = directory + '/' + file.key, cached = labels.get(cacheKey);
          if (cached && cached.modified === file.modified) { file.label = cached.label; continue; }
          try {
            const { value } = await readSaved(directory, file.key);
            if (kind === 'attempts') {
              const a = asAttempt(value, file.key);
              file.label = `#${String(a.attemptId).padStart(3, '0')} · ${displayTimestamp(a.createdAt)} · ${a.passage?.author ?? a.label} · ${a.passage?.title ?? a.source.title}${a.status !== 'ready' ? ' [' + a.status + ']' : ''}`;
            } else if (kind === 'collection') {
              const r = value as { startedAt?: string; status?: string };
              file.label = `${displayTimestamp(r.startedAt ?? '')} · ${r.status ?? 'unknown'} · ${file.key}`;
            }
          } catch { file.label = file.key + ' [unreadable record]'; }
          if (labels.size >= 5000) labels.clear();
          labels.set(cacheKey, { modified: file.modified, label: file.label });
        }
        send(200, 'text/html', renderReviewPage(archive, kind as ReviewKind, files, selected?.key));
      } else if (!selected) send(404, 'text/plain', 'No saved records.');
      else {
        const raw = url.searchParams.get('raw') === '1';
        const { value, text } = await readSaved(directory, selected.key, !raw);
        if (raw) { send(200, 'application/json', text); return; }
        let html: string;
        if (kind === 'attempts') {
          const attempt = asAttempt(value, selected.key);
          let reviews: Reviews = {};
          try { reviews = (await readSaved(directory, 'reviews.json')).value as Reviews; }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
          html = renderAttemptHtml(attempt, directory, reviews[String(attempt.attemptId)]);
        } else html = renderSavedDataHtml(selected.key, value);
        send(200, 'text/html', html);
      }
    } catch (error) {
      send(422, 'text/html', '<!doctype html><meta charset="utf-8"><h1>Cannot display this saved record</h1><pre>' + escape(error instanceof Error ? error.message : String(error)) + '</pre>');
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}

export function registerReviewServer(program: Command): void {
  program.command('review')
    .description('Browse saved passages and collection data in a read-only web viewer; no generation')
    .option('--host <address>', 'listen address (use existing Tailscale/firewall access)', '0.0.0.0')
    .option('--port <number>', 'HTTP port', '19829')
    .option('--allow-host <hostname>', 'additional exact Host hostname, e.g. the machine tailnet DNS name', (v: string, previous: string[]) => [...previous, v], [])
    .action(async options => {
      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1–65535.');
      const server = createReviewServer({ dailyDirectory: program.opts().dailyDir,
        previewDirectory: process.env.TYPE_BLITZ_DAILY_DIR ?? join(homedir(), 'runs/type-blitz/daily-preview'),
        allowedHosts: options.allowHost });
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, options.host, resolve); });
      console.log(`Read-only Type-Blitz review listening on ${options.host}:${port}`);
      const stop = () => { server.close(); server.closeIdleConnections(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    });
}
