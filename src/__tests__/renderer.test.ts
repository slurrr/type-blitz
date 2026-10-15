import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
import { renderStreamView } from '../renderer/streamView.js';
import { renderHeader, renderFooter } from '../renderer/retroHeader.js';
import { renderMenuView, renderPassageSelectView, renderHighScoresView, renderInitialsEntryView, renderSummaryView } from '../renderer/statsDisplay.js';
import { renderCountdownFrame } from '../renderer/countdown.js';
import { stripAnsi, visibleWidth } from '../renderer/displayWidth.js';
import { MENU_ACTIONS } from '../navigation.js';
import { ANSI, renderTerminalFrame } from '../renderer/ansi.js';

function runRendererTests() {
  console.log('🧪 Running Stream View and Border Verification Tests...\n');

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

  // Initially: 0 typed chars. The upcoming passage remains native terminal text.
  const initialView = renderStreamView(engine);
  const streamRowInitial = initialView.find(line => line.includes('Hello'));
  assert.ok(streamRowInitial, 'Stream row should render passage text');

  // Type 'H' (correct)
  engine.handleKey('H');
  const typedView = renderStreamView(engine);
  const streamRowTyped = typedView.find(line => line.includes('ello'));
  assert.ok(streamRowTyped, 'Stream row should render typed passage text');

  for (const columns of [40, 60, 80, 120]) {
    Object.defineProperty(process.stdout, 'columns', { value: columns, configurable: true });
    const screens = [
      renderHeader('A Tale of Two Cities', 'Charles Dickens'),
      renderFooter('[J/K, ↑/↓] MOVE | [L/ENTER/SPACE] SELECT | [Q] QUIT'),
      renderFooter('[J/K, ↑/↓] MOVE | [L/ENTER] START | [H/ESC] BACK'),
      renderMenuView(0, true),
      renderMenuView(0, false),
      renderPassageSelectView(0),
      renderHighScoresView([], 0, 10),
      renderInitialsEntryView(['A', 'A', 'A'], 0, 100),
      renderSummaryView(engine, true),
      renderSummaryView(engine, false),
      renderCountdownFrame('GET READY!')
    ];
    for (const screen of screens) {
      for (const line of screen) assert.strictEqual(visibleWidth(line), columns, `line must fit ${columns} columns: ${stripAnsi(line)}`);
    }
  }

  const frame = renderTerminalFrame(['long screen', 'final row']);
  assert.ok(frame.startsWith(ANSI.moveTo(1, 1)), 'frame should replace content from terminal home');
  assert.ok(frame.endsWith(ANSI.eraseToEnd), 'frame should erase stale rows from a taller prior screen');
  assert.ok(!frame.includes(ANSI.clearScreen), 'frame should not blank the terminal before replacement content');

  const menuText = stripAnsi(renderMenuView(0, true).join('\n'));
  assert.ok(menuText.includes('NEON REFLEXES READY'));
  assert.ok(!/Sol|passages|OLDER PACK|Writing/.test(menuText), 'no daily metadata/status decorations');
  assert.ok(menuText.indexOf('QUICK PLAY (DAILY GEN AI)') < menuText.indexOf('RANDOM CLASSIC'));
  assert.deepEqual(MENU_ACTIONS, ['daily', 'classic', 'select', 'custom', 'scores', 'sound', 'exit']);
  assert.ok(!menuText.includes('Use [UP/DOWN]'), 'menu body must not duplicate footer navigation');

  const scoresHelp = stripAnsi(renderHighScoresView([], 0, 10).join('\n'));
  assert.ok(scoresHelp.includes('[J/K,↑/↓]'));
  assert.ok(scoresHelp.includes('[H/ESC]'));
  for (const highScore of [false, true]) {
    const summary = stripAnsi(renderSummaryView(engine, highScore).join('\n'));
    assert.ok(summary.includes('[L/ENTER]'));
    assert.ok(summary.includes('[H/M]'));
  }

  console.log('✅ Stream View and Border Tests PASSED!\n');
}

runRendererTests();
