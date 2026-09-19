import { Palette } from './ansi.js';

const ANSI_PATTERN = /\x1b\[[0-?]*[ -\/]*[@-~]/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

export function visibleWidth(value: string): number {
  return Array.from(stripAnsi(value)).length;
}

function ansiTokens(value: string): string[] {
  const tokens: string[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(new RegExp(ANSI_PATTERN.source, 'g'))) {
    if (match.index! > lastIndex) tokens.push(...Array.from(value.slice(lastIndex, match.index)));
    tokens.push(match[0]);
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < value.length) tokens.push(...Array.from(value.slice(lastIndex)));
  return tokens;
}

export function visibleSlice(value: string, start: number, end: number): string {
  let column = 0;
  let result = '';
  for (const token of ansiTokens(value)) {
    if (token.startsWith('\x1b[')) {
      if (column <= end) result += token;
      continue;
    }
    if (column >= start && column < end) result += token;
    column += 1;
  }
  return result;
}

export function fitVisible(value: string, width: number): string {
  const clipped = visibleSlice(value, 0, Math.max(0, width));
  const padding = Math.max(0, width - visibleWidth(clipped));
  return clipped + '\x1b[0m' + ' '.repeat(padding);
}

export function normalizeFramedLines(lines: string[], columns: number): string[] {
  if (columns < 2) return lines.map(line => fitVisible(line, Math.max(1, columns)));
  return lines.map(line => {
    const width = visibleWidth(line);
    if (width < 2) return fitVisible(line, columns);
    const plain = stripAnsi(line);
    const first = Array.from(plain)[0];
    const last = Array.from(plain).at(-1);
    if (!first || !last || !'╔╠║╚'.includes(first) || !'╗╣║╝'.includes(last)) {
      return fitVisible(line, columns);
    }
    const content = visibleSlice(line, 1, width - 1);
    return Palette.neonBorder(first) + fitVisible(content, columns - 2) + Palette.neonBorder(last);
  });
}
