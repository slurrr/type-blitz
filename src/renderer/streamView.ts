import { Palette, getTerminalDimensions } from './ansi.js';
import { GameEngine } from '../engine/gameEngine.js';
import { normalizeFramedLines } from './displayWidth.js';
import { EffectCell, FLAME_ROWS, TypingEffects, renderEffectCharacter, renderTextFlames } from './typingEffects.js';

export interface StreamEffectsOptions {
  cells?: EffectCell[];
  kitty?: boolean;
  now?: number;
}

export function renderStreamView(engine: GameEngine, effects: StreamEffectsOptions = {}): string[] {
  const { cols } = getTerminalDimensions();
  const result: string[] = [];

  const text = engine.passage.text;
  const typed = engine.typedInput;
  const stats = engine.getStats();
  const now = effects.now ?? performance.now();
  const cells = effects.cells ?? new TypingEffects().sample(engine, cols, now);
  const cellsByIndex = new Map(cells.map(cell => [cell.index, cell]));

  // Width of internal content inside border
  const innerWidth = Math.max(0, cols - 2);
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

  // Real graphics occupy these rows in Kitty; the text path gets a small flame fallback.
  const flameLines = effects.kitty ? Array<string>(FLAME_ROWS).fill(' '.repeat(innerWidth))
    : renderTextFlames(cells, innerWidth, now);
  for (const line of flameLines) result.push(Palette.neonBorder('║') + line + Palette.neonBorder('║'));

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
      const cell = cellsByIndex.get(textIdx);
      // Kitty paints the actual eroding glyph / ice block at this exact cell.
      streamLine += effects.kitty || !cell ? ' ' : renderEffectCharacter(cell);
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

  return normalizeFramedLines(result, cols);
}
