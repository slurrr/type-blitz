/**
 * Utility functions for measuring and padding strings that contain ANSI escape codes.
 */

// Regular expression to match ANSI escape codes (CSI sequences)
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Calculates the visible character length of a string, ignoring ANSI escape sequences.
 */
export function visibleLength(str: string): number {
  if (!str) return 0;
  return str.replace(ANSI_REGEX, '').length;
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
