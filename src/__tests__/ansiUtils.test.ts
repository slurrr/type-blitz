import assert from 'node:assert';
import { visibleLength, stripAnsi, padAnsiLine, formatFramedLine } from '../renderer/ansiUtils.js';
import { Palette } from '../renderer/ansi.js';

function runTests() {
  console.log('🧪 Running ANSI Utilities Tests...\n');

  // Test 1: Visible length calculation
  const raw = 'Hello World';
  const colored = Palette.cyan('Hello') + ' ' + Palette.magenta('World');
  assert.strictEqual(visibleLength(colored), raw.length);
  console.log('  ✓ Correctly calculates visible length ignoring ANSI escape codes');

  // Test 2: Stripping ANSI
  const coloredText = Palette.yellow('TESTING 123');
  assert.strictEqual(stripAnsi(coloredText), 'TESTING 123');
  console.log('  ✓ Strips ANSI codes completely');

  // Test 3: Padding ANSI lines
  const coloredWord = Palette.yellow('TEST');
  const padded = padAnsiLine(coloredWord, 20);
  assert.strictEqual(visibleLength(padded), 20);
  assert.strictEqual(stripAnsi(padded), 'TEST                ');
  console.log('  ✓ Pads ANSI strings accurately to target total column width');

  // Test 4: Formatted framed lines
  const left = Palette.neonBorder('║');
  const right = Palette.neonBorder('║');
  const content = Palette.cyan('CENTRED CONTENT');
  const line = formatFramedLine(left, content, right, 40);

  assert.strictEqual(visibleLength(line), 40);
  assert.strictEqual(stripAnsi(line), '║CENTRED CONTENT                       ║');
  console.log('  ✓ Formats framed lines with exact target column width including borders');

  console.log('\n✅ All ANSI Utility tests passed!\n');
}

runTests();
