import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HighScoreRecord } from '../types.js';

const CONFIG_DIR = typeof os.homedir === 'function' ? path.join(os.homedir(), '.config', 'type-blitz') : '/tmp/type-blitz';
const DEFAULT_SCORES_FILE = path.join(CONFIG_DIR, 'highscores.json');

export function getScoresFilePath(): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.TYPE_BLITZ_SCORES_FILE || DEFAULT_SCORES_FILE;
  }
  return DEFAULT_SCORES_FILE;
}

export function loadNodeHighScores(maxCount: number = 100): HighScoreRecord[] {
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
        .map((r: HighScoreRecord) => ({
          ...r,
          initials: (r.initials || 'AAA').toUpperCase().slice(0, 3)
        }))
        .sort((a: HighScoreRecord, b: HighScoreRecord) => b.wpm - a.wpm)
        .slice(0, maxCount);
    }
  } catch {
    // Return empty array if read fails
  }
  return [];
}

export function saveNodeHighScore(record: Omit<HighScoreRecord, 'id' | 'date'>, maxCount: number = 100): HighScoreRecord {
  const scores = loadNodeHighScores(maxCount);
  const formattedInitials = (record.initials || 'AAA').toUpperCase().padEnd(3, 'A').slice(0, 3);
  const newRecord: HighScoreRecord = {
    ...record,
    initials: formattedInitials,
    id: Math.random().toString(36).substring(2, 9),
    date: new Date().toISOString().split('T')[0]
  };

  scores.push(newRecord);
  scores.sort((a, b) => b.wpm - a.wpm);
  const topScores = scores.slice(0, maxCount);

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
