/**
 * Utility functions for measuring, padding, and truncating strings that contain ANSI escape codes
 * and wide Unicode/emoji symbols with exact cell-width precision.
 */

// Regular expression to match ANSI escape codes (CSI sequences)
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Calculates the terminal cell display width of a single Unicode code point.
 */
export function getCharWidth(codePoint: number): number {
  // Variation selectors & non-spacing combining characters
  if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) return 0;
  if (codePoint >= 0x0300 && codePoint <= 0x036f) return 0;

  // Single-cell Miscellaneous Symbols, Technical, Arrows & Glyphs (e.g. ⚡, ★, ♫, ◆, ▶, ■, ▲, ▼, ❖)
  if (codePoint >= 0x2000 && codePoint <= 0x2bff) return 1;

  // Wide Emojis (Surrogate pairs 0x1F300-0x1F9FF, 0x1F600-0x1F6FF), CJK Ideographs
  if (
    (codePoint >= 0x1f300 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x1f600 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f680 && codePoint <= 0x1f6ff) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xff00 && codePoint <= 0xffef)
  ) {
    return 2;
  }

  return 1;
}

/**
 * Calculates the visible terminal cell width of a string, ignoring ANSI escape sequences
 * and correctly accounting for 1-cell and 2-cell wide Unicode symbols and emojis.
 */
export function visibleLength(str: string): number {
  if (!str) return 0;
  const stripped = str.replace(ANSI_REGEX, '');
  let width = 0;
  for (let i = 0; i < stripped.length; i++) {
    const codePoint = stripped.codePointAt(i);
    if (codePoint !== undefined) {
      width += getCharWidth(codePoint);
      // Skip second code unit of surrogate pair
      if (codePoint > 0xffff) {
        i++;
      }
    }
  }
  return width;
}

/**
 * Strips ANSI escape codes completely.
 */
export function stripAnsi(str: string): string {
  if (!str) return '';
  return str.replace(ANSI_REGEX, '');
}

/**
 * Truncates a string (which may contain ANSI escape codes) to a maximum visible cell width
 * without breaking ANSI sequences or wide characters.
 */
export function truncateAnsi(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  let currentWidth = 0;
  let result = '';
  let i = 0;

  while (i < str.length && currentWidth < maxWidth) {
    // If ANSI escape sequence, preserve it (0 width)
    if (str[i] === '\x1b') {
      const match = str.slice(i).match(/^\x1b\[[0-9;]*[a-zA-Z]/);
      if (match) {
        result += match[0];
        i += match[0].length;
        continue;
      }
    }

    const codePoint = str.codePointAt(i) || 0;
    const charWidth = getCharWidth(codePoint);

    if (currentWidth + charWidth > maxWidth) {
      break;
    }

    if (codePoint > 0xffff) {
      result += str.slice(i, i + 2);
      i += 2;
    } else {
      result += str[i];
      i++;
    }

    currentWidth += charWidth;
  }

  const missing = Math.max(0, maxWidth - currentWidth);
  return result + '\x1b[0m' + ' '.repeat(missing);
}

/**
 * Pads or truncates a string (containing ANSI codes) to fit an exact target cell width.
 */
export function padAnsiLine(str: string, targetWidth: number, fillChar: string = ' '): string {
  const visible = visibleLength(str);
  if (visible > targetWidth) {
    return truncateAnsi(str, targetWidth);
  }
  const missing = Math.max(0, targetWidth - visible);
  return str + fillChar.repeat(missing);
}

/**
 * Formats a framed line with left border, content padded/truncated to fit totalCols, and right border.
 */
export function formatFramedLine(
  leftBorder: string,
  content: string,
  rightBorder: string,
  totalCols: number
): string {
  const leftVis = visibleLength(leftBorder);
  const rightVis = visibleLength(rightBorder);
  const contentWidth = Math.max(0, totalCols - leftVis - rightVis);
  const paddedContent = padAnsiLine(content, contentWidth);
  return `${leftBorder}${paddedContent}${rightBorder}`;
}
