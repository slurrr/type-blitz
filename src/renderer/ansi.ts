import chalk from 'chalk';

export const ANSI = {
  clearScreen: '\x1b[2J\x1b[3J\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  clearLine: '\x1b[2K',
  reset: '\x1b[0m',
  beep: '\x07'
};

export const Palette = {
  neonOrangeBg: chalk.bgRgb(255, 110, 0).rgb(0, 0, 0).bold,
  neonOrangeFg: chalk.rgb(255, 140, 0).bold,
  errorRedBg: chalk.bgRgb(230, 20, 50).rgb(255, 255, 255).bold,
  errorRedFg: chalk.rgb(255, 50, 70).bold,
  cyan: chalk.rgb(0, 245, 255),
  magenta: chalk.rgb(255, 30, 220),
  yellow: chalk.rgb(255, 215, 0).bold,
  green: chalk.rgb(50, 255, 120),
  dim: chalk.rgb(120, 130, 150),
  brightWhite: chalk.rgb(240, 245, 255),
  darkBg: chalk.bgRgb(15, 16, 28),
  subtleLine: chalk.rgb(70, 75, 100),
  neonBorder: chalk.rgb(255, 0, 180).bold
};

export function getTerminalDimensions(): { rows: number; cols: number } {
  if (typeof process !== 'undefined' && process.stdout) {
    return {
      rows: process.stdout.rows || 24,
      cols: process.stdout.columns || 80
    };
  }
  return {
    rows: 25,
    cols: 80
  };
}
