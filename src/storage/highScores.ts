import { HighScoreRecord } from '../types.js';
import { BrowserLocalStorageAdapter, MAX_HIGH_SCORES } from './scoreAdapter.js';
import { loadNodeHighScores, saveNodeHighScore } from './nodeStorage.js';

export { MAX_HIGH_SCORES };

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const browserAdapter = new BrowserLocalStorageAdapter();

export function loadHighScores(): HighScoreRecord[] {
  if (isBrowser) {
    return browserAdapter.loadHighScores();
  }
  return loadNodeHighScores(MAX_HIGH_SCORES);
}

export function getScoreRank(wpm: number): number {
  if (isBrowser) {
    return browserAdapter.getScoreRank(wpm);
  }

  if (wpm <= 0) return 0;
  const scores = loadHighScores();
  if (scores.length === 0) return 1;

  for (let i = 0; i < scores.length; i++) {
    if (wpm > scores[i].wpm) {
      return i + 1;
    }
  }

  if (scores.length < MAX_HIGH_SCORES) {
    return scores.length + 1;
  }

  return 0;
}

export function qualifiesForHighScore(wpm: number): boolean {
  return getScoreRank(wpm) > 0;
}

export function saveHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>): HighScoreRecord {
  if (isBrowser) {
    return browserAdapter.saveHighScore(record);
  }
  return saveNodeHighScore(record, MAX_HIGH_SCORES);
}
