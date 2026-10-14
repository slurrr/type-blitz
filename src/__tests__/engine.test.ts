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
  const beforeBlockedBackspace = { ...engine };
  for (let i = 0; i < 5; i++) assert.strictEqual(engine.handleBackspace(), 'blocked');
  assert.deepStrictEqual({ ...engine }, beforeBlockedBackspace, 'blocked backspace changes no input, counters or streak');

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
  assert.strictEqual(engine.handleBackspace(), 'erased'); // 'Callx'
  assert.strictEqual(engine.errorIndex, 4);
  assert.strictEqual(engine.handleBackspace(), 'erased'); // 'Call'
  assert.strictEqual(engine.errorIndex, -1); // Error cleared!
  assert.strictEqual(engine.handleBackspace(), 'blocked');
  assert.strictEqual(engine.typedInput, 'Call', 'backspace stops exactly at the correct prefix');

  // Test 5: Typing correct character after fixing error
  const correctSpace = engine.handleKey(' ');
  assert.strictEqual(correctSpace.isError, false);
  assert.strictEqual(engine.typedInput, 'Call ');
  assert.strictEqual(engine.errorIndex, -1);
  assert.strictEqual(engine.handleBackspace(), 'blocked', 'correct spaces ignite too');
  assert.strictEqual(engine.typedInput, 'Call ');

  // Test 6: WPM and Stats calculation
  const stats = engine.getStats();
  assert.ok(stats.totalCharsTyped > 0);
  assert.ok(stats.accuracy < 100); // Made 2 typos total

  // Empty input and completed rounds are quiet no-ops. A first-key typo is erasable.
  const short = new GameEngine({ ...passage, text: 'Hi' });
  short.start();
  const empty = { ...short };
  assert.strictEqual(short.handleBackspace(), 'ignored');
  assert.deepStrictEqual({ ...short }, empty);
  short.handleKey('x');
  short.handleKey('i'); // Matching expected char still belongs to the error cascade.
  assert.strictEqual(short.handleBackspace(), 'erased');
  assert.strictEqual(short.errorIndex, 0);
  assert.strictEqual(short.handleBackspace(), 'erased');
  assert.strictEqual(short.typedInput, '');
  assert.strictEqual(short.errorIndex, -1);
  short.handleKey('H');
  assert.strictEqual(short.handleBackspace(), 'blocked');
  assert.strictEqual(short.handleKey('i').completed, true);
  const completed = { ...short };
  assert.strictEqual(short.handleBackspace(), 'ignored');
  assert.deepStrictEqual({ ...short }, completed);
  short.start();
  assert.strictEqual(short.typedInput, '', 'restart explicitly restores the passage');
  assert.strictEqual(short.handleKey('H').isError, false);

  console.log('✅ All Game Engine Tests PASSED!\n');
}

runTests();
