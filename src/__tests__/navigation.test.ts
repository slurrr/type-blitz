import assert from 'node:assert/strict';
import type { Key } from 'node:readline';
import type { GameState } from '../types.js';
import { navigationKey } from '../navigation.js';

const expected: Record<GameState, string[]> = {
  // h, j, k, l respectively. No back at the root or forward on the leaderboard.
  MENU: ['h', 'down', 'up', 'return'],
  PASSAGE_SELECT: ['escape', 'down', 'up', 'return'],
  HIGH_SCORES: ['escape', 'down', 'up', 'l'],
  SUMMARY: ['escape', 'j', 'k', 'return'],
  PLAYING: ['h', 'j', 'k', 'l'],
  PAUSED: ['h', 'j', 'k', 'l'],
  CUSTOM_INPUT: ['h', 'j', 'k', 'l'],
  INITIALS_ENTRY: ['h', 'j', 'k', 'l'],
  COUNTDOWN: ['h', 'j', 'k', 'l'],
  DAILY_WAIT: ['escape', 'j', 'k', 'return']
};
for (const state of Object.keys(expected) as GameState[]) {
  for (const [index, name] of [...'hjkl'].entries()) {
    const key: Key = { name, sequence: name, ctrl: false, meta: false, shift: false };
    const mapped = navigationKey(state, key);
    assert.equal(mapped.name, expected[state][index], `${state}: ${name}`);
    assert.equal(key.name, name, 'mapping must not mutate input');
    assert.equal(mapped.sequence, name, 'preserve other key metadata');
    for (const modifier of ['ctrl', 'meta', 'shift'] as const) {
      const modified = { ...key, [modifier]: true };
      assert.equal(navigationKey(state, modified), modified, `${state}: modified ${name} is not navigation`);
    }
  }
  for (const name of ['up', 'down', 'left', 'right', 'return', 'space', 'escape', 'pageup', 'pagedown', 'home', 'end', 'q', 'r', 'm', '1', '6']) {
    const key = { name };
    assert.equal(navigationKey(state, key), key, `${state}: existing ${name} binding preserved`);
  }
  const unnamed = { sequence: '?' };
  assert.equal(navigationKey(state, unnamed), unnamed);
}
console.log('✅ HJKL navigation, text-entry protection and existing binding tests passed.');
