import { Palette, getTerminalDimensions } from './ansi.js';
import { GameEngine } from '../engine/gameEngine.js';
import { visibleLength, formatFramedLine, padAnsiLine } from './ansiUtils.js';

export function renderStreamView(engine: GameEngine, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const result: string[] = [];

  const text = engine.passage.text;
  const typed = engine.typedInput;
  const errorIdx = engine.errorIndex;
  const stats = engine.getStats();

  // Width of internal content inside border (cols minus left & right border chars)
  const innerWidth = Math.max(20, cols - 2);
  const centerX = Math.floor(innerWidth / 2);

  // Determine current active focal position in the text
  const activePos = typed.length;

  // Render stats bar box
  const statsBar = ` WPM: ${Palette.yellow(stats.wpm.toString())} | ACC: ${Palette.cyan(stats.accuracy + '%')} | STREAK: ${Palette.magenta(stats.maxStreak.toString())} | ERRORS: ${stats.errorsMade > 0 ? Palette.errorRedFg(stats.errorsMade.toString()) : Palette.green('0')} | TIME: ${Palette.green(stats.elapsedSeconds + 's')} `;
  const statsVisLen = visibleLength(statsBar);
  const statsPad = Math.max(0, innerWidth - statsVisLen);
  const leftStatsPad = ' '.repeat(Math.floor(statsPad / 2));
  const statsContent = leftStatsPad + statsBar;

  result.push(formatFramedLine(Palette.neonBorder('║'), statsContent, Palette.neonBorder('║'), cols));
  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  // Center Marker Indicator (80s target arrow)
  const leftTargetPad = Math.max(0, centerX - 5);
  const targetArrowLine = ' '.repeat(leftTargetPad) + Palette.neonOrangeFg('▼ TARGET ▼');
  result.push(formatFramedLine(Palette.neonBorder('║'), targetArrowLine, Palette.neonBorder('║'), cols));

  // Single Line Passage Stream rendering
  let streamLine = '';

  for (let col = 0; col < innerWidth; col++) {
    const textIdx = activePos + (col - centerX);

    if (textIdx < 0) {
      streamLine += ' ';
    } else if (textIdx < typed.length) {
      if (errorIdx !== -1 && textIdx >= errorIdx) {
        const wrongChar = typed[textIdx] || (textIdx < text.length ? text[textIdx] : ' ');
        streamLine += Palette.errorRedBg(wrongChar);
      } else {
        const correctChar = textIdx < text.length ? text[textIdx] : ' ';
        streamLine += Palette.neonOrangeBg(correctChar);
      }
    } else if (textIdx < text.length) {
      const char = text[textIdx];
      streamLine += Palette.brightWhite(char);
    } else {
      streamLine += ' ';
    }
  }

  // Stream Line Row
  result.push(formatFramedLine(Palette.neonBorder('║'), streamLine, Palette.neonBorder('║'), cols));

  // Center Marker Bottom Indicator
  const leftBottomPad = Math.max(0, centerX - 5);
  const bottomArrowLine = ' '.repeat(leftBottomPad) + Palette.neonOrangeFg('▲ CENTER ▲');
  result.push(formatFramedLine(Palette.neonBorder('║'), bottomArrowLine, Palette.neonBorder('║'), cols));

  result.push(Palette.neonBorder('╠' + '═'.repeat(innerWidth) + '╣'));

  // Current Word Context & Progress bar
  const progressPercent = Math.min(100, Math.round((typed.length / text.length) * 100));
  const barWidth = Math.max(10, Math.floor(innerWidth / 3));
  const filledWidth = Math.floor((progressPercent / 100) * barWidth);
  const progressBar = Palette.cyan('█'.repeat(filledWidth)) + Palette.subtleLine('░'.repeat(barWidth - filledWidth));

  const wordInfo = engine.getCurrentWordInfo();
  const currentWordDisplay = wordInfo.word ? `WORD: "${Palette.yellow(wordInfo.word)}"` : '';

  const statusText = ` ${currentWordDisplay} | PROGRESS: [${progressBar}] ${progressPercent}% `;
  const statusVisLen = visibleLength(statusText);
  const statusPad = Math.max(0, innerWidth - statusVisLen);
  const leftStatusPad = ' '.repeat(Math.floor(statusPad / 2));
  const statusContent = leftStatusPad + statusText;

  result.push(formatFramedLine(Palette.neonBorder('║'), statusContent, Palette.neonBorder('║'), cols));

  return result;
}
