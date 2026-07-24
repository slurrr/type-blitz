import { HighScoreRecord } from '../types.js';

export const MAX_HIGH_SCORES = 100;

export interface ScoreStorageAdapter {
  loadHighScores(): HighScoreRecord[];
  getScoreRank(wpm: number): number;
  qualifiesForHighScore(wpm: number): boolean;
  saveHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>): HighScoreRecord;
}

export class BrowserLocalStorageAdapter implements ScoreStorageAdapter {
  private STORAGE_KEY = 'type_blitz_high_scores';

  public loadHighScores(): HighScoreRecord[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const records: HighScoreRecord[] = JSON.parse(raw);
        return records
          .map(r => ({
            ...r,
            initials: (r.initials || 'AAA').toUpperCase().slice(0, 3)
          }))
          .sort((a, b) => b.wpm - a.wpm)
          .slice(0, MAX_HIGH_SCORES);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  public getScoreRank(wpm: number): number {
    if (wpm <= 0) return 0;
    const scores = this.loadHighScores();
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

  public qualifiesForHighScore(wpm: number): boolean {
    return this.getScoreRank(wpm) > 0;
  }

  public saveHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>): HighScoreRecord {
    const scores = this.loadHighScores();
    const formattedInitials = (record.initials || 'AAA').toUpperCase().padEnd(3, 'A').slice(0, 3);
    const newRecord: HighScoreRecord = {
      ...record,
      initials: formattedInitials,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0]
    };
    scores.push(newRecord);
    scores.sort((a, b) => b.wpm - a.wpm);
    const topScores = scores.slice(0, MAX_HIGH_SCORES);

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(topScores));
    } catch {
      // Fallback
    }

    return newRecord;
  }
}
