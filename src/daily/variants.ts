import { THINKING_LEVELS, type ThinkingLevel } from './types.js';

export interface WriterVariant { model: string; thinking: ThinkingLevel }

/** Resolve CLI comparison settings before loading credentials or creating any attempts. */
export function comparisonVariants(options: {
  model?: string; thinking?: string; variant?: string[];
}): WriterVariant[] {
  let entries: { model: string; thinking: string }[];
  if (options.variant?.length) {
    if (options.model || options.thinking) throw new Error('Use --variant OR --model/--thinking, not both.');
    entries = options.variant.map(value => {
      const split = value.lastIndexOf(':');
      if (split < 1) throw new Error('Variant must be model:thinking, e.g. gpt-5.6-sol:off.');
      return { model: value.slice(0, split), thinking: value.slice(split + 1) };
    });
  } else {
    if (!options.model) throw new Error('Choose --model or repeatable --variant model:thinking options.');
    entries = (options.thinking ?? 'low,xhigh').split(',').map(thinking => ({ model: options.model!, thinking }));
  }
  if (entries.length < 2) throw new Error('A comparison needs at least two model/effort variants.');
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9._-]+$/.test(entry.model) || !THINKING_LEVELS.includes(entry.thinking as ThinkingLevel)) {
      throw new Error('Invalid model ID or thinking level; efforts are off,low,medium,high,xhigh.');
    }
  }
  if (new Set(entries.map(v => JSON.stringify(v))).size !== entries.length) {
    throw new Error('Duplicate variants would create accidental extra calls.');
  }
  return entries as WriterVariant[];
}
