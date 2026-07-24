import { GameEngine } from '../engine/gameEngine.js';
import { Palette, getTerminalDimensions } from './ansi.js';
import { HighScoreRecord } from '../types.js';
import { LITERARY_PASSAGES } from '../passages/passages.js';

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
  const innerWidth = Math.max(20, cols - 4);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  const badge = Palette.neonOrangeBg(' ★ NEW HIGH SCORE RECORD! ★ ');
  const badgeLen = 27;
  const badgeMargin = Math.max(0, Math.floor((innerWidth - badgeLen) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(badgeMargin) + badge + ' '.repeat(Math.max(0, innerWidth - badgeLen - badgeMargin)) + Palette.neonBorder('║'));

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  const promptText = `SCORE: ${Palette.yellow(statsWpm + ' WPM')}  -  ENTER ARCADE INITIALS:`;
  const promptPlain = promptText.replace(/\x1b\[[0-9;]*m/g, '').length;
  const promptMargin = Math.max(0, Math.floor((innerWidth - promptPlain) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(promptMargin) + promptText + ' '.repeat(Math.max(0, innerWidth - promptPlain - promptMargin)) + Palette.neonBorder('║'));

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  // Render initials boxes: [ C ] [ Y ] [ B ]
  const box0 = activeSlot === 0 ? Palette.neonOrangeBg(` ${initials[0]} `) : Palette.cyan(` ${initials[0]} `);
  const box1 = activeSlot === 1 ? Palette.neonOrangeBg(` ${initials[1]} `) : Palette.cyan(` ${initials[1]} `);
  const box2 = activeSlot === 2 ? Palette.neonOrangeBg(` ${initials[2]} `) : Palette.cyan(` ${initials[2]} `);

  const boxesLine = `  [ ${box0} ]   [ ${box1} ]   [ ${box2} ]  `;
  const boxesPlainLen = 29;
  const boxesMargin = Math.max(0, Math.floor((innerWidth - boxesPlainLen) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(boxesMargin) + boxesLine + ' '.repeat(Math.max(0, innerWidth - boxesPlainLen - boxesMargin)) + Palette.neonBorder('║'));

  // Pointer indicator under active slot
  const arrowSpacing = activeSlot === 0 ? 5 : activeSlot === 1 ? 14 : 23;
  const arrowLine = ' '.repeat(arrowSpacing) + Palette.yellow('▲');
  const arrowMargin = boxesMargin;
  result.push(Palette.neonBorder('║') + ' '.repeat(arrowMargin) + arrowLine + ' '.repeat(Math.max(0, innerWidth - arrowLine.length - arrowMargin)) + Palette.neonBorder('║'));

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const help = Palette.dim('Type 3 Letters OR [UP/DOWN] Change, [LEFT/RIGHT] Move  |  [ENTER] Confirm');
  const helpPlain = help.replace(/\x1b\[[0-9;]*m/g, '').length;
  const helpMargin = Math.max(0, Math.floor((innerWidth - helpPlain) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(helpMargin) + help + ' '.repeat(Math.max(0, innerWidth - helpPlain - helpMargin)) + Palette.neonBorder('║'));

  return result;
}

export function renderSummaryView(engine: GameEngine, isNewHighScore: boolean): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 4);
  const result: string[] = [];
  const stats = engine.getStats();
  const gradeInfo = calculateGrade(stats.wpm, stats.accuracy);

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  // Header Title
  const scoreHeader = Palette.yellow('═══ RUN COMPLETED ═══');
  const scoreHeadMargin = Math.max(0, Math.floor((innerWidth - 21) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(scoreHeadMargin) + scoreHeader + ' '.repeat(Math.max(0, innerWidth - 21 - scoreHeadMargin)) + Palette.neonBorder('║'));

  if (isNewHighScore) {
    const hsBadge = Palette.neonOrangeBg(' ★ QUALIFIES FOR TOP 100 ARCADE LEADERBOARD! ★ ');
    const hsMargin = Math.max(0, Math.floor((innerWidth - 46) / 2));
    result.push(Palette.neonBorder('║') + ' '.repeat(hsMargin) + hsBadge + ' '.repeat(Math.max(0, innerWidth - 46 - hsMargin)) + Palette.neonBorder('║'));
  }

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  // Grade Display
  const gradeText = `GRADE: [ ${Palette.magenta(gradeInfo.grade)} ] - ${gradeInfo.title}`;
  const gradePlainLen = gradeText.replace(/\x1b\[[0-9;]*m/g, '').length;
  const gradeMargin = Math.max(0, Math.floor((innerWidth - gradePlainLen) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(gradeMargin) + gradeText + ' '.repeat(Math.max(0, innerWidth - gradePlainLen - gradeMargin)) + Palette.neonBorder('║'));

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  // Stats Grid Table
  const row1 = `  WPM (NET): ${Palette.yellow(stats.wpm.toString().padStart(3))}       RAW WPM: ${Palette.cyan(stats.rawWpm.toString().padStart(3))}  `;
  const row2 = `  ACCURACY: ${Palette.green((stats.accuracy + '%').padStart(4))}       STREAK:  ${Palette.magenta(stats.maxStreak.toString().padStart(3))}  `;
  const row3 = `  ERRORS:   ${stats.errorsMade > 0 ? Palette.errorRedFg(stats.errorsMade.toString().padStart(3)) : Palette.green('  0')}       TIME:    ${Palette.brightWhite(stats.elapsedSeconds + 's')}  `;

  for (const r of [row1, row2, row3]) {
    const plainLen = r.replace(/\x1b\[[0-9;]*m/g, '').length;
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(Palette.neonBorder('║') + ' '.repeat(margin) + r + ' '.repeat(Math.max(0, innerWidth - plainLen - margin)) + Palette.neonBorder('║'));
  }

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const promptText = isNewHighScore
    ? `${Palette.yellow('[ENTER/SPACE] Save High Score Initials')}  |  ${Palette.magenta('[M] Menu')}  |  ${Palette.errorRedFg('[Q] Quit')}`
    : `${Palette.yellow('[SPACE/ENTER] Next Passage')}  |  ${Palette.cyan('[R] Retry')}  |  ${Palette.magenta('[M] Menu')}  |  ${Palette.errorRedFg('[Q] Quit')}`;
  const promptPlain = promptText.replace(/\x1b\[[0-9;]*m/g, '').length;
  const promptMargin = Math.max(0, Math.floor((innerWidth - promptPlain) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(promptMargin) + promptText + ' '.repeat(Math.max(0, innerWidth - promptPlain - promptMargin)) + Palette.neonBorder('║'));

  return result;
}

export function renderMenuView(selectedIndex: number, soundEnabled: boolean): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 4);
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
  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  options.forEach((opt, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg(' ➤ ') : '   ';
    const label = isSelected ? Palette.neonOrangeBg(` ${opt} `) : Palette.brightWhite(opt);
    const line = prefix + label;
    const plainLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const margin = Math.max(0, Math.floor((innerWidth - plainLen) / 2));
    result.push(Palette.neonBorder('║') + ' '.repeat(margin) + line + ' '.repeat(Math.max(0, innerWidth - plainLen - margin)) + Palette.neonBorder('║'));
  });

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const navHelp = Palette.dim('Use [UP/DOWN] or [1-6] to Select  |  [ENTER/SPACE] to Confirm');
  const navPlain = navHelp.replace(/\x1b\[[0-9;]*m/g, '').length;
  const navMargin = Math.max(0, Math.floor((innerWidth - navPlain) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(navMargin) + navHelp + ' '.repeat(Math.max(0, innerWidth - navPlain - navMargin)) + Palette.neonBorder('║'));

  return result;
}

export function renderPassageSelectView(selectedIndex: number): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 4);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  result.push(Palette.neonBorder('║') + Palette.yellow('  === SELECT LITERATURE PASSAGE ===').padEnd(innerWidth) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));

  LITERARY_PASSAGES.forEach((p, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? Palette.neonOrangeFg('► ') : '  ';
    const titleStr = `${p.title} (${p.year}) - ${p.author}`;
    const formatted = isSelected ? Palette.neonOrangeBg(` ${titleStr} `) : Palette.cyan(titleStr);
    const fullLine = prefix + formatted + Palette.dim(` [${p.genre}]`);

    const plainLen = fullLine.replace(/\x1b\[[0-9;]*m/g, '').length;
    const lineStr = fullLine + ' '.repeat(Math.max(0, innerWidth - plainLen));
    result.push(Palette.neonBorder('║') + lineStr.slice(0, innerWidth + (fullLine.length - plainLen)) + Palette.neonBorder('║'));
  });

  result.push(Palette.neonBorder('║') + ' '.repeat(innerWidth) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  const previewPassage = LITERARY_PASSAGES[selectedIndex];
  const snippet = `PREVIEW: "${previewPassage.text.slice(0, Math.max(10, innerWidth - 12))}..."`;
  const snippetPlain = snippet.replace(/\x1b\[[0-9;]*m/g, '').length;
  result.push(Palette.neonBorder('║') + Palette.dim(snippet.padEnd(innerWidth)).slice(0, innerWidth + (snippet.length - snippetPlain)) + Palette.neonBorder('║'));

  return result;
}

export function renderHighScoresView(
  scores: HighScoreRecord[],
  scrollOffset: number = 0,
  maxVisibleRows: number = 10
): string[] {
  const { cols } = getTerminalDimensions();
  const innerWidth = Math.max(20, cols - 4);
  const result: string[] = [];

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  const headerStr = '  RANK | TAG | GRADE | WPM | ACC  | WORK                      | DATE';
  result.push(Palette.neonBorder('║') + Palette.yellow(headerStr.padEnd(innerWidth)) + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '─'.repeat(innerWidth) + '╣'));

  if (scores.length === 0) {
    const noScores = '       NO HIGH SCORES RECORDED YET. BE THE FIRST!       ';
    const margin = Math.max(0, Math.floor((innerWidth - noScores.length) / 2));
    result.push(Palette.neonBorder('║') + ' '.repeat(margin) + Palette.dim(noScores) + ' '.repeat(Math.max(0, innerWidth - noScores.length - margin)) + Palette.neonBorder('║'));
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
      const plainLen = row.replace(/\x1b\[[0-9;]*m/g, '').length;
      result.push(Palette.neonBorder('║') + (row + ' '.repeat(Math.max(0, innerWidth - plainLen))).slice(0, innerWidth + (row.length - plainLen)) + Palette.neonBorder('║'));
    });
  }

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));
  const total = scores.length;
  const endIdx = Math.min(scrollOffset + maxVisibleRows, total);
  const rangeStr = total > 0 ? `[ #${scrollOffset + 1}-${endIdx} OF ${total} ] ` : '';
  const helpText = `${rangeStr}Use [UP/DOWN/PGUP/PGDN] Scroll | [ESC/M] Menu`;
  const margin = Math.max(0, Math.floor((innerWidth - helpText.length) / 2));
  result.push(Palette.neonBorder('║') + ' '.repeat(margin) + Palette.green(helpText) + ' '.repeat(Math.max(0, innerWidth - helpText.length - margin)) + Palette.neonBorder('║'));

  return result;
}
