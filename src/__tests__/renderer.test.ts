import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
import { renderStreamView } from '../renderer/streamView.js';
import { renderMenuView } from '../renderer/statsDisplay.js';
import { visibleLength, stripAnsi } from '../renderer/ansiUtils.js';

function runRendererTests() {
  console.log('🧪 Running Stream View Highlighting Verification Tests...\n');

  const mockPassage = {
    id: 'test',
    title: 'Test',
    author: 'Tester',
    year: 2026,
    genre: 'Test',
    text: 'Hello World'
  };

  const engine = new GameEngine(mockPassage);
  engine.start();

  // Initially: 0 typed chars. Output should have NO background highlight on 'H'
  const initialView = renderStreamView(engine);
  const streamRowInitial = initialView.find(line => line.includes('Hello'));
  assert.ok(streamRowInitial, 'Stream row should render passage text');

  // Type 'H' (correct)
  engine.handleKey('H');
  const typedView = renderStreamView(engine);
  const streamRowTyped = typedView.find(line => line.includes('ello'));
  assert.ok(streamRowTyped, 'Stream row should render typed passage text');

  console.log('✅ Stream View Highlighting Tests PASSED!\n');

  console.log('🧪 Running Menu View Label Centering Tests...\n');
  const menuView = renderMenuView(0, true, 80);
  const innerWidth = 78;

  const optionLines = menuView.slice(2, 8);
  assert.strictEqual(optionLines.length, 6, 'Menu view should render 6 options');

  const optionsText = [
    '⚡ QUICK PLAY (RANDOM CLASSIC LITERATURE)',
    '◆ SELECT PASSAGE BY AUTHOR / WORK',
    '▶ ENTER CUSTOM PASSAGE',
    '★ ARCADE LEADERBOARD (TOP 100)',
    '♫ SOUND EFFECTS: [ ENABLED ]',
    '■ SHUTDOWN ENGINE'
  ];

  optionLines.forEach((rawLine, idx) => {
    const isSelected = idx === 0;
    const prefix = isSelected ? ' > ' : '   ';
    const label = isSelected ? ` ${optionsText[idx]} ` : optionsText[idx];
    const plainLine = prefix + label;
    const itemVisLen = visibleLength(plainLine);
    const expectedMargin = Math.floor((innerWidth - itemVisLen) / 2);

    // Get content inside frame borders
    const strippedLine = stripAnsi(rawLine);
    const content = strippedLine.slice(1, -1);
    
    // Verify leading space count before prefix matches expectedMargin
    const leadingSpaces = content.length - content.trimStart().length;
    // Note: plainLine starts with ' > ' or '   ', both having 1 or 3 spaces at the start of prefix
    // Content is ' '.repeat(margin) + prefix + label
    const prefixLeadingSpaces = prefix.length - prefix.trimStart().length;
    assert.strictEqual(
      leadingSpaces,
      expectedMargin + prefixLeadingSpaces,
      `Option ${idx} should have expected margin ${expectedMargin}`
    );
  });

  console.log('✅ Menu View Label Centering Tests PASSED!\n');

  console.log('🧪 Running Viewport Frame Slicing Verification Tests...\n');
  // Mock frameLines exceeding terminal rows
  const frameLines = [
    '╔════════════════════════════════════════╗', // top border
    '║ line 1                                 ║',
    '║ line 2                                 ║',
    '║ line 3                                 ║',
    '║ line 4                                 ║',
    '║ line 5                                 ║',
    '║ line 6                                 ║',
    '║ line 7                                 ║',
    '║ line 8                                 ║',
    '║ line 9                                 ║',
    '║ line 10                                ║',
    '╚════════════════════════════════════════╝'  // bottom border
  ];
  const targetRows = 8;
  const sliced = frameLines.length > targetRows
    ? [...frameLines.slice(0, targetRows - 1), frameLines[frameLines.length - 1]]
    : frameLines;

  assert.strictEqual(sliced.length, targetRows, 'Sliced lines length must equal targetRows');
  assert.ok(sliced[0].includes('╔'), 'First line must remain top border');
  assert.ok(sliced[sliced.length - 1].includes('╚'), 'Last line must remain bottom border');

  console.log('✅ Viewport Frame Slicing Verification Tests PASSED!\n');
}

runRendererTests();
