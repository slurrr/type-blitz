import { Palette, getTerminalDimensions } from './ansi.js';
import { GameEngine } from '../engine/gameEngine.js';

export function renderStreamView(engine: GameEngine): string[] {
  const { cols } = getTerminalDimensions();
  const result: string[] = [];

  const text = engine.passage.text;
  const typed = engine.typedInput;
  const errorIdx = engine.errorIndex;
  const stats = engine.getStats();

  // Width of internal content inside border
  const innerWidth = Math.max(20, cols - 4);
  const centerX = Math.floor(innerWidth / 2);

  // Determine current active focal position in the text
  // We align the current cursor / word focal point right at `centerX`
  const activePos = typed.length;

  // Render stats bar box
  const statsBar = ` WPM: ${Palette.yellow(stats.wpm.toString())} | ACC: ${Palette.cyan(stats.accuracy + '%')} | STREAK: ${Palette.magenta(stats.maxStreak.toString())} | ERRORS: ${stats.errorsMade > 0 ? Palette.errorRedFg(stats.errorsMade.toString()) : Palette.green('0')} | TIME: ${Palette.green(stats.elapsedSeconds + 's')} `;
  const statsPad = Math.max(0, innerWidth - statsBar.replace(/\x1b\[[0-9;]*m/g, '').length);
  const leftStatsPad = ' '.repeat(Math.floor(statsPad / 2));
  const rightStatsPad = ' '.repeat(Math.ceil(statsPad / 2));

  result.push(Palette.neonBorder('║') + leftStatsPad + statsBar + rightStatsPad + Palette.neonBorder('║'));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  // Center Marker Indicator (80s target arrow)
  const leftTargetPad = Math.max(0, centerX - 5);
  const targetArrowLine = ' '.repeat(leftTargetPad) + Palette.neonOrangeFg('▼ TARGET ▼') + ' '.repeat(Math.max(0, innerWidth - leftTargetPad - 10));
  result.push(Palette.neonBorder('║') + targetArrowLine + Palette.neonBorder('║'));

  // Single Line Passage Stream rendering
  // Stream buffer generation for columns 0..innerWidth-1
  let streamLine = '';

  for (let col = 0; col < innerWidth; col++) {
    // Map screen column `col` to text index `textIdx`
    const textIdx = activePos + (col - centerX);

    if (textIdx < 0) {
      // Off left edge (before start of passage) -> padded spaces or subtle retro grid dot
      streamLine += ' ';
    } else if (textIdx < typed.length) {
      // Already typed portion
      if (errorIdx !== -1 && textIdx >= errorIdx) {
        // Red Error Highlighter for error index and all subsequent keystrokes
        const wrongChar = typed[textIdx] || (textIdx < text.length ? text[textIdx] : ' ');
        streamLine += Palette.errorRedBg(wrongChar);
      } else {
        // Correctly typed -> Orange Highlighter Effect!
        const correctChar = textIdx < text.length ? text[textIdx] : ' ';
        streamLine += Palette.neonOrangeBg(correctChar);
      }
    } else if (textIdx < text.length) {
      // Upcoming / not typed yet -> normal text with no background highlight
      const char = text[textIdx];
      streamLine += Palette.brightWhite(char);
    } else {
      // Past end of passage -> trailing space
      streamLine += ' ';
    }
  }

  // Stream Line Row
  result.push(Palette.neonBorder('║') + streamLine + Palette.neonBorder('║'));

  // Center Marker Bottom Indicator
  const leftBottomPad = Math.max(0, centerX - 5);
  const bottomArrowLine = ' '.repeat(leftBottomPad) + Palette.neonOrangeFg('▲ CENTER ▲') + ' '.repeat(Math.max(0, innerWidth - leftBottomPad - 10));
  result.push(Palette.neonBorder('║') + bottomArrowLine + Palette.neonBorder('║'));

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  // Current Word Context & Progress bar
  const progressPercent = Math.min(100, Math.round((typed.length / text.length) * 100));
  const barWidth = Math.max(10, Math.floor(innerWidth / 3));
  const filledWidth = Math.floor((progressPercent / 100) * barWidth);
  const progressBar = Palette.cyan('█'.repeat(filledWidth)) + Palette.subtleLine('░'.repeat(barWidth - filledWidth));

  const wordInfo = engine.getCurrentWordInfo();
  const currentWordDisplay = wordInfo.word ? `WORD: "${Palette.yellow(wordInfo.word)}"` : '';

  const statusText = ` ${currentWordDisplay} | PROGRESS: [${progressBar}] ${progressPercent}% `;
  const statusPlainLen = statusText.replace(/\x1b\[[0-9;]*m/g, '').length;
  const statusPad = Math.max(0, innerWidth - statusPlainLen);
  const leftStatusPad = ' '.repeat(Math.floor(statusPad / 2));
  const rightStatusPad = ' '.repeat(Math.ceil(statusPad / 2));

  result.push(Palette.neonBorder('║') + leftStatusPad + statusText + rightStatusPad + Palette.neonBorder('║'));

  return result;
}
