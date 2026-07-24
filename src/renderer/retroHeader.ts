import figlet from 'figlet';
import { Palette, getTerminalDimensions } from './ansi.js';

let cachedBanner: string[] | null = null;

export function getRetroBanner(): string[] {
  if (cachedBanner) return cachedBanner;
  try {
    const raw = figlet.textSync('TYPE-BLITZ', { font: 'Slant' });
    const lines = raw.split('\n');
    cachedBanner = lines.map(line => {
      // Apply a synthwave gradient: Cyan to Magenta
      let colored = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const ratio = i / Math.max(1, line.length);
        if (ratio < 0.5) {
          colored += Palette.cyan(char);
        } else {
          colored += Palette.magenta(char);
        }
      }
      return colored;
    });
    return cachedBanner;
  } catch {
    return [
      Palette.cyan('  _____ _   _ ___ _____ _____ ___ _     ___ _____ _____ '),
      Palette.magenta(' |_   _| | | |  _|_   _|  ___/  _(_)   |_ _|_   _|__  / '),
      Palette.magenta('   | | | |_| |  _| | | |  |_ |  _| |    | |  | |   / /  '),
      Palette.cyan('   |_|  \\___/|_|   |_| |____|_| |_|___ |___| |_|  /____|')
    ];
  }
}

export function renderHeader(passageTitle?: string, author?: string): string[] {
  const { cols } = getTerminalDimensions();
  const bannerLines = getRetroBanner();
  const result: string[] = [];

  // Top Neon Line
  const titleText = ' ❖ SYNTHWAVE ' + (passageTitle ? `| ${passageTitle.toUpperCase()} by ${author?.toUpperCase()} ` : '') + '❖ ';
  const padLength = Math.max(0, cols - titleText.length - 4);
  const leftPad = '═'.repeat(Math.floor(padLength / 2));
  const rightPad = '═'.repeat(Math.ceil(padLength / 2));

  result.push(Palette.neonBorder(`╔${leftPad}`) + Palette.yellow(titleText) + Palette.neonBorder(`${rightPad}╗`));

  // Add centered ASCII Banner lines if terminal wide enough
  if (cols >= 60) {
    for (const bLine of bannerLines) {
      const plainLength = bLine.replace(/\x1b\[[0-9;]*m/g, '').length;
      const margin = Math.max(0, Math.floor((cols - plainLength - 2) / 2));
      const leftPadStr = ' '.repeat(margin);
      const rightPadStr = ' '.repeat(Math.max(0, cols - plainLength - margin - 2));
      result.push(Palette.neonBorder('║') + leftPadStr + bLine + rightPadStr + Palette.neonBorder('║'));
    }
  }

  // 80s Perspective Grid line accent
  const gridSegment = Palette.magenta('▲') + Palette.cyan('─') + Palette.magenta('▼') + Palette.cyan('─');
  const repeats = Math.floor((cols - 2) / 4);
  const gridRow = Palette.neonBorder('║') + gridSegment.repeat(repeats).padEnd(cols - 2) + Palette.neonBorder('║');
  result.push(gridRow);

  return result;
}

export function renderFooter(controlsHelp: string): string[] {
  const { cols } = getTerminalDimensions();
  const result: string[] = [];

  const helpText = ` [ ${controlsHelp} ] `;
  const padLength = Math.max(0, cols - helpText.length - 4);
  const leftPad = '═'.repeat(Math.floor(padLength / 2));
  const rightPad = '═'.repeat(Math.ceil(padLength / 2));

  result.push(Palette.neonBorder(`╚${leftPad}`) + Palette.green(helpText) + Palette.neonBorder(`${rightPad}╝`));

  return result;
}
