import { Palette, getTerminalDimensions } from './ansi.js';
import { visibleLength, formatFramedLine } from './ansiUtils.js';

const RAW_BANNER_LINES = [
  "  ________  ______  ______     ____  __    _______________",
  " /_  __/\\ \\/ / __ \\/ ____/    / __ )/ /   /  _/_  __/__  /",
  "  / /    \\  / /_/ / __/______/ __  / /    / /  / /    / / ",
  " / /     / / ____/ /__/_____/ /_/ / /____/ /  / /    / /__",
  "/_/     /_/_/   /_____/    /_____/_____/___/ /_/    /____/"
];

let cachedBanner: string[] | null = null;

export function getRetroBanner(): string[] {
  if (cachedBanner) return cachedBanner;

  cachedBanner = RAW_BANNER_LINES.map(line => {
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
}

export function renderHeader(passageTitle?: string, author?: string, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const bannerLines = getRetroBanner();
  const result: string[] = [];

  // Top Neon Line
  const titleText = ' [ SYNTHWAVE ] ' + (passageTitle ? `| ${passageTitle.toUpperCase()} by ${author?.toUpperCase()} ` : '') + '[ 1984 ] ';
  const titleVisLen = visibleLength(titleText);
  const padLength = Math.max(0, cols - titleVisLen - 2);
  const leftPad = '═'.repeat(Math.floor(padLength / 2));
  const rightPad = '═'.repeat(Math.ceil(padLength / 2));

  result.push(Palette.neonBorder(`╔${leftPad}`) + Palette.yellow(titleText) + Palette.neonBorder(`${rightPad}╗`));

  // Add centered ASCII Banner lines if terminal wide enough
  if (cols >= 60) {
    for (const bLine of bannerLines) {
      const plainLength = visibleLength(bLine);
      const margin = Math.max(0, Math.floor((cols - plainLength - 2) / 2));
      const leftPadStr = ' '.repeat(margin);
      const content = leftPadStr + bLine;
      result.push(formatFramedLine(Palette.neonBorder('║'), content, Palette.neonBorder('║'), cols));
    }
  }

  // 80s Perspective Grid line accent centered
  const gridSegment = Palette.magenta('^') + Palette.cyan('-') + Palette.magenta('v') + Palette.cyan('-');
  const available = cols - 2;
  const repeats = Math.floor((available - 2) / 4);
  const gridCore = gridSegment.repeat(repeats);
  const coreLen = visibleLength(gridCore);
  const leftSpace = Math.floor((available - coreLen) / 2);
  const rightSpace = available - coreLen - leftSpace;
  const gridContent = ' '.repeat(leftSpace) + gridCore + ' '.repeat(rightSpace);
  const gridRow = formatFramedLine(Palette.neonBorder('║'), gridContent, Palette.neonBorder('║'), cols);
  result.push(gridRow);

  return result;
}

export function renderFooter(controlsHelp: string, customCols?: number): string[] {
  const cols = customCols || getTerminalDimensions().cols;
  const result: string[] = [];

  const helpText = ` [ ${controlsHelp} ] `;
  const helpVisLen = visibleLength(helpText);
  const padLength = Math.max(0, cols - helpVisLen - 2);
  const leftPad = '═'.repeat(Math.floor(padLength / 2));
  const rightPad = '═'.repeat(Math.ceil(padLength / 2));

  result.push(Palette.neonBorder(`╚${leftPad}`) + Palette.green(helpText) + Palette.neonBorder(`${rightPad}╝`));

  return result;
}
