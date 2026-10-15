import { readFile } from 'node:fs/promises';
import type { WriterRequest } from './types.js';

export const PRESENTATION_FORMAT = 'passage-presentation-v1';
export const PRESENTATION_LIMITS = { title: 35, name: 24, descriptor: 28 } as const;
export interface Presentation { title: string; name: string; descriptor: string; text: string }

/** One existing model call; keep source input and voice prose instructions independent. */
export async function withPresentation(request: WriterRequest): Promise<WriterRequest> {
  const format = await readFile(new URL('../../prompts/presentation.md', import.meta.url), 'utf8');
  return { ...request, outputFormat: PRESENTATION_FORMAT, systemPrompt: request.systemPrompt + '\n\n' + format.trim() };
}

/** No guessing, truncation, prose rewriting or retries. The caller retains the raw response. */
export function parsePresentation(raw: string): Presentation {
  if (typeof raw !== 'string' || raw.length > 6000) throw new Error('Oversized presentation output.');
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('Expected presentation JSON with title, name, descriptor and text. Raw output retained; no automatic retry.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'descriptor,name,text,title') {
    throw new Error('Presentation must contain exactly title, name, descriptor and text.');
  }
  const p = value as Presentation;
  for (const [key, max] of Object.entries(PRESENTATION_LIMITS) as [keyof typeof PRESENTATION_LIMITS, number][]) {
    const text = p[key];
    if (typeof text !== 'string' || !text.trim() || text !== text.trim() || text.length > max ||
        /[^\x20-\x7e]|https?:\/\/|www\.|[<>`*{}]/.test(text)) {
      throw new Error(`Invalid presentation ${key}: use plain ASCII, 1-${max} characters, no markup or URLs. No truncation or automatic retry.`);
    }
  }
  if (typeof p.text !== 'string') throw new Error('Presentation text must be a string.');
  return p;
}
