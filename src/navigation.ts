import type { Key } from 'node:readline';
import type { GameState } from './types.js';

const bindings: Partial<Record<GameState, Readonly<Record<string, string>>>> = {
  MENU: { j: 'down', k: 'up', l: 'return' },
  PASSAGE_SELECT: { j: 'down', k: 'up', l: 'return', h: 'escape' },
  HIGH_SCORES: { j: 'down', k: 'up', h: 'escape' },
  SUMMARY: { l: 'return', h: 'escape' }
};

/** Vim-style aliases only on navigation screens; text entry keeps every letter. */
export function navigationKey(state: GameState, key: Key): Key {
  if (key.ctrl || key.meta || key.shift || !key.name) return key;
  const name = bindings[state]?.[key.name];
  return name ? { ...key, name } : key;
}
