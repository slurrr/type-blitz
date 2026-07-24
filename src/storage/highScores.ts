import { HighScoreRecord } from '../types.js';
import { BrowserLocalStorageAdapter, MAX_HIGH_SCORES } from './scoreAdapter.js';

export { MAX_HIGH_SCORES };

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const browserAdapter = new BrowserLocalStorageAdapter();

export function loadHighScores(): HighScoreRecord[] {
  if (isBrowser) {
    return browserAdapter.loadHighScores();
  }
  try {
    const { loadNodeHighScores } = require('./nodeStorage.js');
    return loadNodeHighScores(MAX_HIGH_SCORES);
  } catch {
    return [];
  }
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
  try {
    const { saveNodeHighScore } = require('./nodeStorage.js');
    return saveNodeHighScore(record, MAX_HIGH_SCORES);
  } catch {
    const formattedInitials = (record.initials || 'AAA').toUpperCase().padEnd(3, 'A').slice(0, 3);
    return {
      ...record,
      initials: formattedInitials,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0]
    };
  }
}
