import { GameEngine } from '../engine/gameEngine.js';
import { Palette, getTerminalDimensions } from './ansi.js';
import { HighScoreRecord } from '../types.js';
import { LITERARY_PASSAGES } from '../passages/passages.js';
import { visibleLength, formatFramedLine } from './ansiUtils.js';

export function calculateGrade(wpm: number, accuracy: number): { grade: string; title: string } {
  if (wpm >= 100 && accuracy >= 97) return { grade: 'S+', title: '⚡ CYBER GOD ⚡' };
  if (wpm >= 80 && accuracy >= 95) return { grade: 'A+', title: '🔥 SYNTH SPEEDSTER 🔥' };
  if (wpm >= 60 && accuracy >= 90) return { grade: 'A', title: '🚀 TURBO TYPIST 🚀' };
  if (wpm >= 40 && accuracy >= 85) return { grade: 'B', title: '🕹️ NEON CRUISER 🕹️' };
  if (wpm >= 25 && accuracy >= 75) return { grade: 'C', title: '📼 RETRO TYPER 📼' };
  return { grade: 'D', title: '💾 CASSETTE SLOWPOKE 💾' };
}

export function renderInitialsEntryView(initials: string[], activeSlot: number, statsWpm: number): string[] {
  const { cols } = getTerminalDimensions();
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

  // Render initials boxes: [ C ] [ Y ] [ B ]
  const box0 = activeSlot === 0 ? Palette.neonOrangeBg(` ${initials[0]} `) : Palette.cyan(` ${initials[0]} `);
  const box1 = activeSlot === 1 ? Palette.neonOrangeBg(` ${initials[1]} `) : Palette.cyan(` ${initials[1]} `);
  const box2 = activeSlot === 2 ? Palette.neonOrangeBg(` ${initials[2]} `) : Palette.cyan(` ${initials[2]} `);

  const boxesLine = `  [ ${box0} ]   [ ${box1} ]   [ ${box2} ]  `;
  const boxesPlainLen = visibleLength(boxesLine);
  const boxesMargin = Math.max(0, Math.floor((innerWidth - boxesPlainLen) / 2));
  const boxesContent = ' '.repeat(boxesMargin) + boxesLine;
  result.push(formatFramedLine(Palette.neonBorder('║'), boxesContent, Palette.neonBorder('║'), cols));

  // Pointer indicator under active slot
  const arrowSpacing = activeSlot === 0 ? 5 : activeSlot === 1 ? 14 : 23;
  const arrowLine = ' '.repeat(arrowSpacing) + Palette.yellow('▲');
  const arrowContent = ' '.repeat(boxesMargin) + arrowLine;
  result.push(formatFramedLine(Palette.neonBorder('║'), arrowContent, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const help = Palette.dim('Type 3 Letters OR [UP/DOWN] Change, [LEFT/RIGHT] Move  |  [ENTER] Confirm');
  const helpPlain = visibleLength(help);
  const helpMargin = Math.max(0, Math.floor((innerWidth - helpPlain) / 2));
  const helpContent = ' '.repeat(helpMargin) + help;
  result.push(formatFramedLine(Palette.neonBorder('║'), helpContent, Palette.neonBorder('║'), cols));

  return result;
}

export function renderSummaryView(engine: GameEngine, isNewHighScore: boolean): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];
  const stats = engine.getStats();
  const gradeInfo = calculateGrade(stats.wpm, stats.accuracy);

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  // Header Title
  const scoreHeader = Palette.yellow('═══ RUN COMPLETED ═══');
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

  // Grade Display
  const gradeText = `GRADE: [ ${Palette.magenta(gradeInfo.grade)} ] - ${gradeInfo.title}`;
  const gradePlainLen = visibleLength(gradeText);
  const gradeMargin = Math.max(0, Math.floor((innerWidth - gradePlainLen) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(gradeMargin) + gradeText, Palette.neonBorder('║'), cols));

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  // Stats Grid Table
  const row1 = `  WPM (NET): ${Palette.yellow(stats.wpm.toString().padStart(3))}       RAW WPM: ${Palette.cyan(stats.rawWpm.toString().padStart(3))}  `;
  const row2 = `  ACCURACY: ${Palette.green((stats.accuracy + '%').padStart(4))}       STREAK:  ${Palette.magenta(stats.maxStreak.toString().padStart(3))}  `;
  const row3 = `  ERRORS:   ${stats.errorsMade > 0 ? Palette.errorRedFg(stats.errorsMade.toString().padStart(3)) : Palette.green('  0')}       TIME:    ${Palette.brightWhite(stats.elapsedSeconds + 's')}  `;

  for (const r of [row1, row2, row3]) {
    const plainLen = visibleLength(r);
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + r, Palette.neonBorder('║'), cols));
  }

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const promptText = isNewHighScore
    ? `${Palette.yellow('[ENTER/SPACE] Save High Score Initials')}  |  ${Palette.magenta('[M] Menu')}  |  ${Palette.errorRedFg('[Q] Quit')}`
    : `${Palette.yellow('[SPACE/ENTER] Next Passage')}  |  ${Palette.cyan('[R] Retry')}  |  ${Palette.magenta('[M] Menu')}  |  ${Palette.errorRedFg('[Q] Quit')}`;
  const promptPlain = visibleLength(promptText);
  const promptMargin = Math.max(0, Math.floor((innerWidth - promptPlain) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(promptMargin) + promptText, Palette.neonBorder('║'), cols));

  return result;
}

export function renderMenuView(selectedIndex: number, soundEnabled: boolean): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  const options = [
    '⚡ QUICK PLAY (RANDOM CLASSIC LITERATURE)',
    '📚 SELECT PASSAGE BY AUTHOR / WORK',
    '✍️  ENTER CUSTOM TEXT',
    '🏆 ARCADE HIGH SCORES (TOP 100)',
    `🔊 SOUND EFFECTS: [ ${soundEnabled ? Palette.green('ENABLED') : Palette.dim('DISABLED')} ]`,
    '❌ EXIT GAME'
  ];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  options.forEach((opt, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg(' ➤ ') : '   ';
    const label = isSelected ? Palette.neonOrangeBg(` ${opt} `) : Palette.brightWhite(opt);
    const line = prefix + label;
    const plainLen = visibleLength(line);
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + line, Palette.neonBorder('║'), cols));
  });

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const navHelp = Palette.dim('Use [UP/DOWN] or [1-6] to Select  |  [ENTER/SPACE] to Confirm');
  const navPlain = visibleLength(navHelp);
  const navMargin = Math.max(0, Math.floor((innerWidth - navPlain) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(navMargin) + navHelp, Palette.neonBorder('║'), cols));

  return result;
}

export function renderPassageSelectView(selectedIndex: number): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 2);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(formatFramedLine(Palette.neonBorder('║'), Palette.yellow('  === SELECT LITERATURE PASSAGE ==='), Palette.neonBorder('║'), cols));
  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));

  LITERARY_PASSAGES.forEach((p, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg('► ') : '  ';
    const titleStr = `${p.title} (${p.year}) - ${p.author}`;
    const formatted = isSelected ? Palette.neonOrangeBg(` ${titleStr} `) : Palette.cyan(titleStr);
    const fullLine = prefix + formatted + Palette.dim(` [${p.genre}]`);

    result.push(formatFramedLine(Palette.neonBorder('║'), fullLine, Palette.neonBorder('║'), cols));
  });

  result.push(formatFramedLine(Palette.neonBorder('║'), '', Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const previewPassage = LITERARY_PASSAGES[selectedIndex];
  const snippet = `PREVIEW: "${previewPassage.text.slice(0, Math.max(10, innerWidth - 12))}..."`;
  result.push(formatFramedLine(Palette.neonBorder('║'), Palette.dim(snippet), Palette.neonBorder('║'), cols));

  return result;
}

export function renderHighScoresView(
  scores: HighScoreRecord[],
  scrollOffset: number = 0,
  maxVisibleRows: number = 10
): string[] {
  const { cols } = getTerminalDimensions();
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

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  const total = scores.length;
  const endIdx = Math.min(scrollOffset + maxVisibleRows, total);
  const rangeStr = total > 0 ? `[ #${scrollOffset + 1}-${endIdx} OF ${total} ] ` : '';
  const helpText = `${rangeStr}Use [UP/DOWN/PGUP/PGDN] Scroll | [ESC/M] Menu`;
  const margin = Math.max(0, Math.floor((innerWidth - helpText.length) / 2));
  result.push(formatFramedLine(Palette.neonBorder('║'), ' '.repeat(margin) + Palette.green(helpText), Palette.neonBorder('║'), cols));

  return result;
}
