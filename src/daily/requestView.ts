import type { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { getAttempt, readReviews } from './history.js';
import type { Attempt, Review } from './types.js';
import { APP_TIMESTAMP_FIELDS, DAILY_TIME_ZONE, displayTimestamp } from './time.js';

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
const prose = (value: unknown) => `<pre><code>${escapeHtml(value)}</code></pre>`;
const label = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** Generic readable projection, without guessing which source fields to omit. No active links/images. */
function fields(value: unknown, depth = 0): string {
  if (value === null) return '<span class="muted">null</span>';
  if (typeof value !== 'object') return prose(value);
  if (depth > 12) return prose(JSON.stringify(value, null, 2));
  if (Array.isArray(value)) return value.length
    ? `<ol>${value.map(item => `<li>${fields(item, depth + 1)}</li>`).join('')}</ol>`
    : '<span class="muted">Empty list</span>';
  return `<dl>${Object.entries(value).map(([key, item]) =>
    `<div><dt>${escapeHtml(label(key))}</dt><dd>${fields(APP_TIMESTAMP_FIELDS.has(key) && typeof item === 'string' ? displayTimestamp(item) : item, depth + 1)}</dd></div>`).join('')}</dl>`;
}

function readableInput(input: string): string {
  const separator = input.indexOf('\n\n');
  if (separator >= 0) {
    try {
      const packet: unknown = JSON.parse(input.slice(separator + 2));
      return prose(input.slice(0, separator)) + fields(packet);
    } catch { /* Plain-text and historical inputs remain visible verbatim. */ }
  }
  return prose(input);
}

/** Render only the saved record; never reload prompts, source pages or model configuration. */
export function renderAttemptHtml(attempt: Attempt, archive: string, review?: Review): string {
  const id = String(attempt.attemptId).padStart(3, '0');
  const audit = attempt.result?.audit;
  const mismatch = audit && (audit.systemPrompt !== attempt.request.systemPrompt || audit.userPrompt !== attempt.request.userPrompt);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Attempt ${id} — ${escapeHtml(attempt.label)}</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.6}
body{max-width:960px;margin:2rem auto;padding:0 1.25rem}h1{line-height:1.2}h2{margin-top:0}
section{margin:1.5rem 0;padding:1.25rem;border:1px solid #8886;border-radius:8px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:.5rem 0}pre code{font:inherit}
dl{margin:0}dt{font-weight:600;font-size:.9rem;color:light-dark(#555,#bbb)}dd{margin:.2rem 0 1rem}
dl dl,ol{border-left:2px solid #8884;padding-left:1.25rem}li{padding:.25rem 0}
summary{cursor:pointer;font-weight:600}details{margin-top:1rem}.muted{opacity:.7}.notice{border-left:4px solid #d88625;padding-left:1rem}
@media print{body{max-width:none}section{border-radius:0}details{display:block}}
</style></head><body>
<header><p class="muted">TYPE-BLITZ · ARCHIVED REQUEST</p><h1>Attempt ${id} · ${escapeHtml(attempt.label)}</h1>
<p>${escapeHtml(attempt.source.title)}</p></header>
<section><h2>At a glance</h2>${fields({
    archive, status: attempt.status, model: attempt.model, thinking: attempt.thinking,
    createdAt: attempt.createdAt, timeZone: DAILY_TIME_ZONE, elapsedMs: attempt.elapsedMs ?? 'Not recorded',
    voice: attempt.voice, execution: attempt.execution, rating: review?.rating ?? 'unrated',
    ...(review?.note ? { reviewNote: review.note } : {}),
    ...(attempt.replayOf ? { replayOf: attempt.replayOf } : {}),
    ...(attempt.result?.usage ? { usage: attempt.result.usage } : {})
  })}</section>
<section><h2>Output</h2>${attempt.passage ? prose(attempt.passage.text) : '<p>No playable passage saved.</p>'}
${attempt.error ? `<p class="notice">${escapeHtml(attempt.error)}</p>` : ''}
${attempt.status === 'pending' ? '<p class="notice">Pending record: the call may still be running or may have been interrupted.</p>' : ''}
${attempt.warnings?.length ? fields({ warnings: attempt.warnings }) : ''}
${attempt.result ? `<details><summary>Raw model output (before typing normalization)</summary>${prose(attempt.result.text)}</details>` : ''}</section>
<section><h2>System / voice prompt</h2>${prose(attempt.request.systemPrompt)}</section>
<section><h2>User message / source material</h2>${readableInput(attempt.request.userPrompt)}
<details><summary>Exact user message</summary>${prose(attempt.request.userPrompt)}</details></section>
<section><h2>Request verification</h2>
<p class="muted">This is the archived system/user request, not a raw HTTP capture. No live source refresh or model call was made to render it.</p>
${mismatch ? '<p class="notice">The recorded audit prompts differ from the saved request. Inspect the complete record below.</p>' : ''}
${fields({ promptFingerprint: attempt.promptId, sourceFingerprint: attempt.sourceId,
    ...(audit ? { payloadVerified: audit.payloadVerified, messageRoles: audit.messageRoles, tools: audit.tools,
      reasoningEffort: audit.reasoningEffort ?? 'Not recorded', auditPromptsMatchRequest: !mismatch }
      : { audit: 'No response audit recorded.' }) })}
<details><summary>Complete archived record</summary>${prose(JSON.stringify(attempt, null, 2))}</details></section>
</body></html>\n`;
}

/** Related saved data, using the same escaped field presentation; no scripts or resource loads. */
export function renderSavedDataHtml(title: string, value: unknown): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(title)}</title><style>
:root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif}body{max-width:960px;margin:2rem auto;padding:0 1.25rem}
h1{font-size:1.3rem;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:.5rem 0}pre code{font:inherit}
dt,summary{font-weight:600}dd{margin:.2rem 0 1rem}dl dl,ol{border-left:2px solid #8884;padding-left:1.25rem}
summary{cursor:pointer}.muted{opacity:.7}
</style></head><body><h1>${escapeHtml(title)}</h1><p class="muted">Saved archive data · read only · App timestamps: ${DAILY_TIME_ZONE}; original JSON below</p>
${fields(value)}<details><summary>Complete saved JSON</summary>${prose(JSON.stringify(value, null, 2))}</details></body></html>`;
}

/** Only derived views are replaced. Immutable requests, ratings and game state are never written. */
export async function saveAttemptHtml(directory: string, id: number, html: string): Promise<string> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Attempt ID must be a positive integer.');
  const output = resolve(directory, 'requests', String(id).padStart(3, '0') + '.html');
  await mkdir(resolve(directory, 'requests'), { recursive: true });
  const temporary = output + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, html, { flag: 'wx', mode: 0o600 });
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  return output;
}

export function registerRequestView(program: Command): void {
  program.command('request')
    .description('Render one archived attempt as readable, self-contained HTML; no generation')
    .argument('<id>', 'attempt number, e.g. 24, 024 or 1000')
    .option('--preview', 'read the separate voice-preview archive instead of the daily game archive')
    .option('--stdout', 'print only HTML, without writing a file (useful over SSH)')
    .action(async (id: string, options: { preview?: boolean; stdout?: boolean }) => {
      if (!/^\d+$/.test(id)) throw new Error('Attempt ID must be a positive integer.');
      const directory = options.preview
        ? process.env.TYPE_BLITZ_DAILY_DIR ?? join(homedir(), 'runs/type-blitz/daily-preview')
        : program.opts().dailyDir as string;
      const attempt = await getAttempt(directory, Number(id));
      const reviews = await readReviews(directory);
      const html = renderAttemptHtml(attempt, resolve(directory), reviews[String(attempt.attemptId)]);
      if (options.stdout) process.stdout.write(html);
      else console.log(await saveAttemptHtml(directory, attempt.attemptId, html));
    });
}
