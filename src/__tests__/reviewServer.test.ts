import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createReviewServer, reviewFiles } from '../daily/reviewServer.js';
import { promptId } from '../daily/history.js';
import { renderAttemptHtml } from '../daily/requestView.js';
import type { Attempt } from '../daily/types.js';

const root = await mkdtemp(join(tmpdir(), 'type-blitz-review-'));
const daily = join(root, 'daily'), preview = join(root, 'preview');
const req = { systemPrompt: 'Exact instructions <script>bad()</script>', userPrompt: 'Exact input\n\n' + JSON.stringify({ text: '<img src=x onerror=bad()>', comments: ['First', 'Second'] }) };
const attempt: Attempt = {
  version: 1, attemptId: 1000, voice: 'student', label: 'Student <script>bad()</script>',
  promptId: promptId(req), sourceId: 'source', source: { title: 'A frozen story & its comments', year: 2026 },
  execution: 'parallel', status: 'pending', createdAt: '2026-10-15T10:00:00Z', model: 'fixture', thinking: 'low', request: req
};
const save = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const server = createReviewServer({ dailyDirectory: daily, previewDirectory: preview, allowedHosts: ['review.test'] });
try {
  for (const dir of [daily, preview]) await mkdir(join(dir, 'attempts'), { recursive: true });
  await save(join(daily, 'attempts/1000-student.pending.json'), attempt);
  await save(join(daily, 'attempts/999-student.json'), { ...attempt, attemptId: 999, status: 'error', error: 'Writer failed' });
  await save(join(preview, 'attempts/1000-student.json'), { ...attempt, status: 'error', error: 'Preview only' });
  await save(join(daily, 'current.json'), { saved: true });
  await save(join(daily, 'state.json'), { status: 'error', error: 'Collection failure' });
  await save(join(daily, 'reviews.json'), {});
  await save(join(daily, 'credentials.json'), { secret: 'NEVER SERVE' });
  await writeFile(join(daily, '.lock'), '1234');
  for (const dir of ['collection', 'packs', 'sources/00000000-0000-0000-0000-000000000000']) await mkdir(join(daily, dir), { recursive: true });
  await save(join(daily, 'collection/run.json'), { status: 'error', events: [{ url: 'https://news.example.org/', reason: '<script>bad()</script>' }] });
  await save(join(daily, 'packs/old.json'), { entries: [] });
  await save(join(daily, 'sources/00000000-0000-0000-0000-000000000000/weather.json'), { forecast: 'saved forecast' });
  await symlink(join(daily, 'credentials.json'), join(daily, 'collection/leak.json'));
  assert.ok(!(await reviewFiles(daily, 'collection')).some(f => f.key.includes('leak')));
  assert.ok(!(await reviewFiles(daily, 'state')).some(f => f.key.includes('credentials')));
  await mkdir(join(root, 'linked'));
  await symlink(join(daily, 'attempts'), join(root, 'linked/attempts'));
  assert.deepEqual(await reviewFiles(join(root, 'linked'), 'attempts'), [], 'do not traverse symlinked archive subdirectories');
  const original = await readFile(join(daily, 'attempts/1000-student.pending.json'), 'utf8');
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<{ status: number; text: string; headers: import('node:http').IncomingHttpHeaders }>((resolve, reject) => {
    const r = request({ hostname: '127.0.0.1', port, path, headers, method }, response => {
      let text = ''; response.setEncoding('utf8'); response.on('data', chunk => text += chunk);
      response.on('end', () => resolve({ status: response.statusCode!, text, headers: response.headers }));
    });
    r.on('error', reject); r.end();
  });
  const q = (archive: string, kind: string, file: string) => new URLSearchParams({ archive, kind, file });
  const url = '/view?' + q('daily', 'attempts', 'attempts/1000-student.pending.json');
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('2026-10-15 04:00:00.000-06:00'));
  assert.ok(!page.text.includes('2026-10-15 10:00Z'));
  assert.ok(page.text.includes('Collection reports') && page.text.includes('Voice experiments'));
  assert.ok(page.text.indexOf('#1000') < page.text.indexOf('#999'), 'numeric ordering works past 999');
  assert.ok(page.text.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!page.text.includes('<script>bad()'));
  assert.ok(page.text.includes('sandbox="allow-same-origin"'));
  assert.ok(page.text.includes('Older →') && page.text.includes('Saved JSON'));
  const view = await get(url);
  assert.equal(view.status, 200);
  assert.equal(view.text, renderAttemptHtml(attempt, daily), 'identical existing request HTML, not a second renderer');
  assert.equal(view.headers['cache-control'], 'no-store');
  assert.match(String(view.headers['content-security-policy']), /frame-ancestors 'self'/);
  const raw = await get(url + '&raw=1');
  assert.equal(raw.text, original, 'raw view is the exact saved file');
  assert.match(String(raw.headers['content-type']), /application\/json/);
  assert.equal((await get(url, {}, 'HEAD')).text, '');
  assert.equal((await get('/', {}, 'POST')).status, 405);
  assert.equal((await get('/?archive=../../elsewhere')).status, 400);
  assert.equal((await get('/?kind=__proto__')).status, 400);
  assert.equal((await get('/view?' + q('daily', 'attempts', '../credentials.json'))).status, 404);
  assert.equal((await get('/view?' + q('daily', 'state', 'credentials.json'))).status, 404);
  assert.equal((await get('/view?' + q('daily', 'collection', 'collection/leak.json'))).status, 404);
  assert.equal((await get('/', { Host: 'evil.example:' + port })).status, 403);
  assert.equal((await get('/', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await get('/', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors' })).status, 403);
  assert.equal((await get('/', { Host: 'review.test:' + port })).status, 200);
  assert.equal((await get('/', { Origin: 'http://127.0.0.1:' + port })).status, 200);
  assert.equal((await get('/', { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' })).status, 200, 'user can follow a link from another site');
  assert.equal((await get('/unknown')).status, 404);
  assert.ok((await get('/review.js')).text.includes('requestSubmit'));
  for (const [kind, file, text] of [
    ['collection', 'collection/run.json', 'https://news.example.org/'],
    ['packs', 'packs/old.json', 'Entries'],
    ['sources', 'sources/00000000-0000-0000-0000-000000000000/weather.json', 'saved forecast'],
    ['state', 'state.json', 'Collection failure']
  ]) {
    const result = await get('/view?' + q('daily', kind, file));
    assert.equal(result.status, 200); assert.ok(result.text.includes(text));
    assert.ok(!result.text.includes('<script>bad()'));
  }
  assert.ok((await get('/view?' + q('preview', 'attempts', 'attempts/1000-student.json'))).text.includes('Preview only'));
  assert.ok(!(await get(url)).text.includes('Preview only'));
  await save(join(daily, 'attempts/1000-student.json'), { ...attempt, status: 'error', error: 'Finished failure' });
  const refreshed = await get('/');
  assert.ok(!refreshed.text.includes('1000-student.pending.json'), 'prefer final if pending cleanup races the reader');
  assert.ok(refreshed.text.includes('[error]'));
  assert.equal((await get('/?' + q('daily', 'attempts', 'attempts/1000-student.pending.json'))).status, 200, 'a pending selection follows its completed record on reload');
  assert.ok((await get('/view?' + q('daily', 'attempts', 'attempts/1000-student.json'))).text.includes('Finished failure'));
  await save(join(daily, 'attempts/1001-student.json'), { ...attempt, attemptId: 1001 });
  assert.ok((await get('/')).text.includes('#1001'), 'new attempts appear without rebuilding HTML or restarting');
  await writeFile(join(daily, 'attempts/1002-student.json'), '{broken');
  assert.ok((await get('/')).text.includes('[unreadable record]'), 'a corrupt file does not hide other records');
  assert.equal((await get('/view?' + q('daily', 'attempts', 'attempts/1002-student.json'))).status, 422);
  assert.equal((await get('/view?' + q('daily', 'attempts', 'attempts/1002-student.json') + '&raw=1')).text, '{broken', 'raw file remains inspectable even when JSON is malformed');
  assert.equal(await readFile(join(daily, 'attempts/1000-student.pending.json'), 'utf8'), original);
  assert.ok(!(await readdir(daily)).includes('requests'), 'viewer writes no exported pages');
  assert.equal(await readFile(join(daily, '.lock'), 'utf8'), '1234', 'viewing never takes/removes a writer lock');
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
}
console.log('✅ Read-only review browser: exact renderer, history, saved data, refresh, isolation, traversal/symlink and Host/Origin controls passed.');
