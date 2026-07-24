import assert from 'node:assert';
import { GameEngine } from '../engine/gameEngine.js';
import { LITERARY_PASSAGES } from '../passages/passages.js';

function runTests() {
  console.log('🧪 Running Type-Blitz Game Engine Verification Tests...\n');

  const passage = LITERARY_PASSAGES[0]; // Moby Dick
  const engine = new GameEngine(passage);
  engine.start();

  // Test 1: Typing correct characters
  assert.strictEqual(engine.typedInput, '');
  assert.strictEqual(engine.errorIndex, -1);

  // Type "Call"
  for (const char of 'Call') {
    const res = engine.handleKey(char);
    assert.strictEqual(res.isError, false);
  }
  assert.strictEqual(engine.typedInput, 'Call');
  assert.strictEqual(engine.errorIndex, -1);

  // Test 2: Making a typo
  // Expected next is ' ', type 'x' instead
  const errorRes = engine.handleKey('x');
  assert.strictEqual(errorRes.isError, true);
  assert.strictEqual(engine.typedInput, 'Callx');
  assert.strictEqual(engine.errorIndex, 4); // Error at index 4

  // Test 3: Subsequent keystrokes while in error state stay in error mode
  const subRes = engine.handleKey('m');
  assert.strictEqual(subRes.isError, true);
  assert.strictEqual(engine.typedInput, 'Callxm');
  assert.strictEqual(engine.errorIndex, 4); // Error still at index 4

  // Test 4: Backspacing clears error state when reaching error index
  engine.handleBackspace(); // 'Callx'
  assert.strictEqual(engine.errorIndex, 4);
  engine.handleBackspace(); // 'Call'
  assert.strictEqual(engine.errorIndex, -1); // Error cleared!

  // Test 5: Typing correct character after fixing error
  const correctSpace = engine.handleKey(' ');
  assert.strictEqual(correctSpace.isError, false);
  assert.strictEqual(engine.typedInput, 'Call ');
  assert.strictEqual(engine.errorIndex, -1);

  // Test 6: WPM and Stats calculation
  const stats = engine.getStats();
  assert.ok(stats.totalCharsTyped > 0);
  assert.ok(stats.accuracy < 100); // Made 2 typos total

  console.log('✅ All Game Engine Tests PASSED!\n');
}

runTests();
