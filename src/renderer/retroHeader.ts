import figlet from 'figlet';
import { Palette, getTerminalDimensions } from './ansi.js';
import { normalizeFramedLines, visibleWidth } from './displayWidth.js';

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

/** Wrap metadata rather than silently losing a title or the end of a byline. */
function wrapHeader(text: string, width: number): string[] {
  const lines: string[] = [];
  let remaining = Array.from(text);
  while (remaining.length > width) {
    const space = remaining.slice(0, width + 1).lastIndexOf(' ');
    const end = space > 0 ? space : width;
    lines.push(remaining.slice(0, end).join(''));
    remaining = Array.from(remaining.slice(end).join('').trimStart());
  }
  if (remaining.length) lines.push(remaining.join(''));
  return lines;
}

export function renderHeader(passageTitle?: string, author?: string): string[] {
  const { cols } = getTerminalDimensions();
  const bannerLines = getRetroBanner();
  const result: string[] = [];

  const width = Math.max(1, cols - 4);
  const byline = author ? `by ${author}` : '';
  const combined = passageTitle ? passageTitle + (byline ? ` — ${byline}` : '') : '❖ SYNTHWAVE ❖';
  const titles = passageTitle && visibleWidth(combined) > width
    ? [...wrapHeader(passageTitle, width), ...wrapHeader(byline, width)]
    : wrapHeader(combined, width);
  for (const [index, title] of titles.entries()) {
    const titleText = ` ${title} `;
    const padLength = Math.max(0, cols - visibleWidth(titleText) - 2);
    const fill = index === 0 ? '═' : ' ';
    const leftPad = fill.repeat(Math.floor(padLength / 2));
    const rightPad = fill.repeat(Math.ceil(padLength / 2));
    result.push(Palette.neonBorder((index === 0 ? '╔' : '║') + leftPad) + Palette.yellow(titleText) +
      Palette.neonBorder(rightPad + (index === 0 ? '╗' : '║')));
  }

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
  const remainder = (cols - 2) - repeats * 4;
  let gridContent = gridSegment.repeat(repeats);
  if (remainder >= 1) gridContent += Palette.magenta('▲');
  if (remainder >= 2) gridContent += Palette.cyan('─');
  if (remainder >= 3) gridContent += Palette.magenta('▼');
  const gridRow = Palette.neonBorder('║') + gridContent + Palette.neonBorder('║');
  result.push(gridRow);

  return normalizeFramedLines(result, cols);
}

export function renderFooter(controlsHelp: string): string[] {
  const { cols } = getTerminalDimensions();
  const result: string[] = [];

  const helpText = ` [ ${controlsHelp} ] `;
  const padLength = Math.max(0, cols - helpText.length - 2);
  const leftPad = '═'.repeat(Math.floor(padLength / 2));
  const rightPad = '═'.repeat(Math.ceil(padLength / 2));

  result.push(Palette.neonBorder(`╚${leftPad}`) + Palette.green(helpText) + Palette.neonBorder(`${rightPad}╝`));

  return normalizeFramedLines(result, cols);
}
