export interface Passage {
  id: string;
  title: string;
  author: string;
  year: number;
  genre: string;
  text: string;
}

export interface GameConfig {
  soundEnabled: boolean;
  retroGrid: boolean;
  showScanlines: boolean;
}

export interface GameStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalCharsTyped: number;
  elapsedSeconds: number;
  streak: number;
  maxStreak: number;
  errorsMade: number;
}

export interface HighScoreRecord {
  id: string;
  initials: string;
  passageTitle: string;
  author: string;
  wpm: number;
  accuracy: number;
  date: string;
  grade: string;
}

export type GameState =
  | 'MENU'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'PAUSED'
  | 'SUMMARY'
  | 'INITIALS_ENTRY'
  | 'PASSAGE_SELECT'
  | 'HIGH_SCORES'
  | 'CUSTOM_INPUT';
