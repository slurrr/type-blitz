import { Passage, GameStats, GameConfig } from '../types.js';

export class GameEngine {
  public passage: Passage;
  public typedInput: string = '';
  public errorIndex: number = -1;
  public startTime: number | null = null;
  public endTime: number | null = null;
  public totalKeystrokes: number = 0;
  public correctKeystrokes: number = 0;
  public incorrectKeystrokes: number = 0;
  public streak: number = 0;
  public maxStreak: number = 0;
  public errorsMade: number = 0;
  public isCompleted: boolean = false;
  public config: GameConfig;

  constructor(passage: Passage, config?: Partial<GameConfig>) {
    this.passage = passage;
    this.config = {
      soundEnabled: true,
      retroGrid: true,
      showScanlines: true,
      ...config
    };
  }

  public start(): void {
    this.startTime = Date.now();
    this.endTime = null;
    this.typedInput = '';
    this.errorIndex = -1;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.incorrectKeystrokes = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.errorsMade = 0;
    this.isCompleted = false;
  }

  public handleKey(char: string): { isError: boolean; completed: boolean } {
    if (this.isCompleted) return { isError: false, completed: true };

    if (!this.startTime) {
      this.startTime = Date.now();
    }

    this.totalKeystrokes++;
    const currentPos = this.typedInput.length;
    const expectedChar = this.passage.text[currentPos];

    // If already in an error state
    if (this.errorIndex !== -1) {
      this.typedInput += char;
      this.incorrectKeystrokes++;
      this.streak = 0;
      return { isError: true, completed: false };
    }

    // Checking new character
    if (char === expectedChar) {
      this.typedInput += char;
      this.correctKeystrokes++;
      this.streak++;
      if (this.streak > this.maxStreak) {
        this.maxStreak = this.streak;
      }

      // Check if finished entire passage
      if (this.typedInput.length >= this.passage.text.length && this.errorIndex === -1) {
        this.isCompleted = true;
        this.endTime = Date.now();
        return { isError: false, completed: true };
      }

      return { isError: false, completed: false };
    } else {
      // Typo made!
      this.errorIndex = currentPos;
      this.typedInput += char;
      this.incorrectKeystrokes++;
      this.errorsMade++;
      this.streak = 0;
      return { isError: true, completed: false };
    }
  }

  public handleBackspace(): void {
    if (this.isCompleted || this.typedInput.length === 0) return;

    const wasInError = this.errorIndex !== -1;
    this.typedInput = this.typedInput.slice(0, -1);

    // If backspaced to or before the error index, clear error mode
    if (this.errorIndex !== -1 && this.typedInput.length <= this.errorIndex) {
      this.errorIndex = -1;
    } else if (!wasInError) {
      // Backspaced a correctly typed character: decrement correctKeystrokes
      this.correctKeystrokes = Math.max(0, this.correctKeystrokes - 1);
    }
  }

  public getStats(): GameStats {
    const now = this.endTime || Date.now();
    const elapsedSeconds = this.startTime ? Math.max(0.1, (now - this.startTime) / 1000) : 0;
    const minutes = elapsedSeconds / 60;

    // Standard WPM: (correct characters / 5) / minutes
    const wordsTyped = this.correctKeystrokes / 5;
    const wpm = minutes > 0 ? Math.round(wordsTyped / minutes) : 0;

    const rawWordsTyped = this.totalKeystrokes / 5;
    const rawWpm = minutes > 0 ? Math.round(rawWordsTyped / minutes) : 0;

    const accuracy = this.totalKeystrokes > 0
      ? Math.max(0, Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100))
      : 100;

    return {
      wpm,
      rawWpm,
      accuracy,
      correctChars: this.correctKeystrokes,
      incorrectChars: this.incorrectKeystrokes,
      totalCharsTyped: this.totalKeystrokes,
      elapsedSeconds: Math.round(elapsedSeconds),
      streak: this.streak,
      maxStreak: this.maxStreak,
      errorsMade: this.errorsMade
    };
  }

  public getCurrentWordInfo(): { word: string; indexInPassage: number } {
    const text = this.passage.text;
    const currentPos = this.typedInput.length;
    
    // Find boundaries of word at currentPos
    let start = currentPos;
    while (start > 0 && text[start - 1] !== ' ') {
      start--;
    }
    let end = currentPos;
    while (end < text.length && text[end] !== ' ') {
      end++;
    }

    return {
      word: text.slice(start, end),
      indexInPassage: start
    };
  }
}
