import { GameEngine } from '../engine/gameEngine.js';
import { Palette, getTerminalDimensions } from './ansi.js';
import { HighScoreRecord } from '../types.js';
import { LITERARY_PASSAGES } from '../passages/passages.js';
import { visibleLength, formatFramedLine } from './ansiUtils.js';

export function calculateGrade(wpm: number, accuracy: number): { grade: string; title: string } {
  if (wpm >= 100 && accuracy >= 97) return { grade: 'S+', title: 'CYBER GOD' };
  if (wpm >= 80 && accuracy >= 95) return { grade: 'A+', title: 'SYNTH SPEEDSTER' };
  if (wpm >= 60 && accuracy >= 90) return { grade: 'A', title: 'TURBO TYPIST' };
  if (wpm >= 40 && accuracy >= 85) return { grade: 'B', title: 'NEON CRUISER' };
  if (wpm >= 25 && accuracy >= 75) return { grade: 'C', title: 'RETRO TYPER' };
  return { grade: 'D', title: 'CASSETTE SLOWPOKE' };
}

export function renderInitialsEntryView(initials: string[], activeSlot: number, statsWpm: number, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const badge = Palette.neonOrangeBg(' ★ NEW HIGH SCORE RECORD! ★ ');
  const badgeLen = visibleLength(badge);
  const badgeMargin = Math.max(0, Math.floor((innerWidth - badgeLen) / 2));
  const badgeLine = ' '.repeat(badgeMargin) + badge;
  result.push(formatFramedLine(Palette.neonBorder('║'), badgeLine, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const promptText = `SCORE: ${Palette.yellow(statsWpm + ' WPM')}  -  ENTER ARCADE INITIALS:`;
  const promptPlain = visibleLength(promptText);
  const promptMargin = Math.max(0, Math.floor((innerWidth - promptPlain) / 2));
  const promptLine = ' '.repeat(promptMargin) + promptText;
  result.push(formatFramedLine(Palette.neonBorder('║'), promptLine, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const box0 = activeSlot === 0 ? Palette.neonOrangeBg(` ${initials[0]} `) : Palette.cyan(` ${initials[0]} `);
  const box1 = activeSlot === 1 ? Palette.neonOrangeBg(` ${initials[1]} `) : Palette.cyan(` ${initials[1]} `);
  const box2 = activeSlot === 2 ? Palette.neonOrangeBg(` ${initials[2]} `) : Palette.cyan(` ${initials[2]} `);

  const boxesLine = `  [ ${box0} ]   [ ${box1} ]   [ ${box2} ]  `;
  const boxesPlainLen = visibleLength(boxesLine);
  const boxesMargin = Math.max(0, Math.floor((innerWidth - boxesPlainLen) / 2));
  const boxesContent = ' '.repeat(boxesMargin) + boxesLine;
  result.push(formatFramedLine(Palette.neonBorder('║'), boxesContent, Palette.neonBorder('║'), cols));

  const arrowSpacing = activeSlot === 0 ? 5 : activeSlot === 1 ? 14 : 23;
  const arrowLine = ' '.repeat(arrowSpacing) + Palette.yellow('^');
  const arrowContent = ' '.repeat(boxesMargin) + arrowLine;
  result.push(formatFramedLine(Palette.neonBorder('║'), arrowContent, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  return result;
}

export function renderSummaryView(engine: GameEngine, isNewHighScore: boolean, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];
  const stats = engine.getStats();
  const gradeInfo = calculateGrade(stats.wpm, stats.accuracy);

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const scoreHeader = Palette.yellow('=== RUN COMPLETED ===');
  const scoreHeadVis = visibleLength(scoreHeader);
  const scoreHeadMargin = Math.max(0, Math.floor((innerWidth - scoreHeadVis) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(scoreHeadMargin) + scoreHeader, Palette.neonBorder('║'), cols));

  if (isNewHighScore) {
    const hsBadge = Palette.neonOrangeBg(' ★ QUALIFIES FOR TOP 100 ARCADE LEADERBOARD! ★ ');
    const hsVis = visibleLength(hsBadge);
    const hsMargin = Math.max(0, Math.floor((innerWidth - hsVis) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(hsMargin) + hsBadge, Palette.neonBorder('║'), cols));
  }

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const gradeText = `GRADE: [ ${Palette.magenta(gradeInfo.grade)} ] - ${gradeInfo.title}`;
  const gradePlainLen = visibleLength(gradeText);
  const gradeMargin = Math.max(0, Math.floor((innerWidth - gradePlainLen) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(gradeMargin) + gradeText, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  const row1 = `  WPM (NET): ${Palette.yellow(stats.wpm.toString().padStart(3))}       RAW WPM: ${Palette.cyan(stats.rawWpm.toString().padStart(3))}  `;
  const row2 = `  ACCURACY: ${Palette.green((stats.accuracy + '%').padStart(4))}       STREAK:  ${Palette.magenta(stats.maxStreak.toString().padStart(3))}  `;
  const row3 = `  ERRORS:   ${stats.errorsMade > 0 ? Palette.errorRedFg(stats.errorsMade.toString().padStart(3)) : Palette.green('  0')}       TIME:    ${Palette.brightWhite(stats.elapsedSeconds + 's')}  `;

  for (const r of [row1, row2, row3]) {
    const plainLen = visibleLength(r);
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + r, Palette.neonBorder('║'), cols));
  }

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  return result;
}

export function renderMenuView(selectedIndex: number, soundEnabled: boolean, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  const options = [
    '⚡ QUICK PLAY (RANDOM CLASSIC LITERATURE)',
    '◆ SELECT PASSAGE BY AUTHOR / WORK',
    '▶ ENTER CUSTOM PASSAGE',
    '★ ARCADE LEADERBOARD (TOP 100)',
    `♫ SOUND EFFECTS: [ ${soundEnabled ? Palette.green('ENABLED') : Palette.dim('DISABLED')} ]`,
    '■ SHUTDOWN ENGINE'
  ];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  options.forEach((opt, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg(' > ') : '   ';
    const label = isSelected ? Palette.neonOrangeBg(` ${opt} `) : Palette.brightWhite(opt);
    const line = prefix + label;
    const plainLen = visibleLength(line);
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + line, Palette.neonBorder('║'), cols));
  });

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  return result;
}

export function renderPassageSelectView(selectedIndex: number, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), Palette.yellow('  === SELECT LITERATURE PASSAGE ==='), Palette.neonBorder('║'), cols));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  LITERARY_PASSAGES.forEach((p, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg(' > ') : '   ';
    const titleStr = `${p.title} (${p.year}) - ${p.author}`;
    const formatted = isSelected ? Palette.neonOrangeBg(` ${titleStr} `) : Palette.cyan(titleStr);
    const fullLine = prefix + formatted + Palette.dim(` [${p.genre}]`);

    result.push(formatFramedLine(Palette.neonBorder('║'), fullLine, Palette.neonBorder('║'), cols));
  });

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  return result;
}

export function renderHighScoresView(
  scores: HighScoreRecord[],
  scrollOffset: number = 0,
  maxVisibleRows: number = 10,
  customCols?: number
): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  const headerStr = '  RANK | TAG | GRADE | WPM | ACC  | WORK                      | DATE';
  result.push(formatFramedLine(Palette.neonBorder('║'), Palette.yellow(headerStr), Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '─'.repeat(innerWidth) + '╣'));

  if (scores.length === 0) {
    const noScores = '       NO HIGH SCORES RECORDED YET. BE THE FIRST!       ';
    const margin = Math.max(0, Math.floor((innerWidth - noScores.length) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + Palette.dim(noScores), Palette.neonBorder('║'), cols));
  } else {
    const visible = scores.slice(scrollOffset, scrollOffset + maxVisibleRows);
    visible.forEach((s, idx) => {
      const actualRank = scrollOffset + idx + 1;
      const rank = `#${actualRank}`.padStart(4);
      const initials = (s.initials || 'AAA').padStart(3);
      const grade = s.grade.padStart(5);
      const wpm = `${s.wpm}`.padStart(4);
      const acc = `${s.accuracy}%`.padStart(4);
      const title = s.passageTitle.slice(0, 22).padEnd(23);
      const date = s.date;
      const row = ` ${rank}  | ${Palette.magenta(initials)} | ${grade} | ${wpm} | ${acc} | ${title} | ${date}`;
      result.push(formatFramedLine(Palette.neonBorder('║'), row, Palette.neonBorder('║'), cols));
    });
  }

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  return result;
}
