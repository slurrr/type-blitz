import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HighScoreRecord } from '../types.js';

export const MAX_HIGH_SCORES = 100;

const CONFIG_DIR = path.join(os.homedir(), '.config', 'type-blitz');
const DEFAULT_SCORES_FILE = path.join(CONFIG_DIR, 'highscores.json');

export function getScoresFilePath(): string {
  return process.env.TYPE_BLITZ_SCORES_FILE || DEFAULT_SCORES_FILE;
}

export function loadHighScores(): HighScoreRecord[] {
  const scoresFile = getScoresFilePath();
  try {
    const dir = path.dirname(scoresFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(scoresFile)) {
      const data = fs.readFileSync(scoresFile, 'utf-8');
      const records: HighScoreRecord[] = JSON.parse(data);
      return records
        .map(r => ({
          ...r,
          initials: (r.initials || 'AAA').toUpperCase().slice(0, 3)
        }))
        .sort((a, b) => b.wpm - a.wpm)
        .slice(0, MAX_HIGH_SCORES);
    }
  } catch {
    // Return empty array if read fails
  }
  return [];
}

export function getScoreRank(wpm: number): number {
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
  const scores = loadHighScores();
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

  const scoresFile = getScoresFilePath();
  try {
    const dir = path.dirname(scoresFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(scoresFile, JSON.stringify(topScores, null, 2), 'utf-8');
  } catch {
    // Ignore save errors gracefully
  }

  return newRecord;
}
