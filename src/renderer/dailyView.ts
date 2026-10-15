import { Palette, getTerminalDimensions } from './ansi.js';
import { normalizeFramedLines } from './displayWidth.js';

export function renderDailyWaitingView(message: string, detail: string, error?: string): string[] {
  const { cols } = getTerminalDimensions();
  const border = Palette.neonBorder('╠' + '═'.repeat(Math.max(20, cols - 2)) + '╣');
  const row = (text: string) => Palette.neonBorder('║') + '  ' + text + Palette.neonBorder('║');
  return normalizeFramedLines([
    border, row(Palette.yellow('QUICK PLAY (DAILY GEN AI)')), row(''),
    row(Palette.cyan(message)), row(detail),
    ...(error ? [row(Palette.errorRedFg(error))] : []),
    row(''), row('Classic play stays available while daily generation runs.'),
    row('[L/ENTER] Play saved pack  [R] Fresh sources + generation'),
    row('[H/ESC] Back to menu'), border
  ], cols);
}
