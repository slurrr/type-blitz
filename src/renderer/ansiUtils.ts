/**
 * Utility functions for measuring and padding strings that contain ANSI escape codes and wide emojis.
 */

// Regular expression to match ANSI escape codes (CSI sequences)
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

// Regular expression to match wide emoji characters
const EMOJI_WIDE_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;

/**
 * Calculates the visible terminal cell width of a string, ignoring ANSI escape sequences
 * and accounting for 2-cell wide emojis.
 */
export function visibleLength(str: string): number {
  if (!str) return 0;
  const stripped = str.replace(ANSI_REGEX, '');
  let len = stripped.length;
  const matches = stripped.match(EMOJI_WIDE_REGEX);
  if (matches) {
    for (const m of matches) {
      if (m.length === 1) {
        len += 1;
      }
    }
  }
  return len;
}

/**
 * Truncates a string to a visible character width without breaking ANSI escape codes.
 */
export function stripAnsi(str: string): string {
  if (!str) return '';
  return str.replace(ANSI_REGEX, '');
}

/**
 * Pads a string (which may contain ANSI escape codes) to a target visible width.
 */
export function padAnsiLine(str: string, targetWidth: number, fillChar: string = ' '): string {
  const visible = visibleLength(str);
  const missing = Math.max(0, targetWidth - visible);
  return str + fillChar.repeat(missing);
}

/**
 * Formats a framed line with left border, content padded to target width, and right border.
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
