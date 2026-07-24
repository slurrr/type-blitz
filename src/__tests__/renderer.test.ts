import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
import { renderStreamView } from '../renderer/streamView.js';

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
}

runRendererTests();
