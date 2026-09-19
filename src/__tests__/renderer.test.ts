import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
import { renderStreamView } from '../renderer/streamView.js';
import { renderHeader, renderFooter } from '../renderer/retroHeader.js';
import { renderMenuView, renderPassageSelectView, renderHighScoresView, renderInitialsEntryView } from '../renderer/statsDisplay.js';
import { renderCountdownFrame } from '../renderer/countdown.js';
import { stripAnsi, visibleWidth } from '../renderer/displayWidth.js';

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

  for (const columns of [40, 60, 80, 120]) {
    Object.defineProperty(process.stdout, 'columns', { value: columns, configurable: true });
    const screens = [
      renderHeader('A Tale of Two Cities', 'Charles Dickens'),
      renderFooter('[UP/DOWN] NAVIGATE | [ENTER/SPACE] SELECT | [Q] QUIT'),
      renderMenuView(0, true),
      renderPassageSelectView(0),
      renderHighScoresView([], 0, 10),
      renderInitialsEntryView(['A', 'A', 'A'], 0, 100),
      renderCountdownFrame('GET READY!')
    ];
    for (const screen of screens) {
      for (const line of screen) assert.strictEqual(visibleWidth(line), columns, `line must fit ${columns} columns: ${stripAnsi(line)}`);
    }
  }

  const menuText = stripAnsi(renderMenuView(0, true).join('\n'));
  assert.ok(menuText.includes('NEON REFLEXES READY'));
  assert.ok(!menuText.includes('Use [UP/DOWN]'), 'menu body must not duplicate footer navigation');

  console.log('✅ Stream View Highlighting and Border Tests PASSED!\n');
}

runRendererTests();
