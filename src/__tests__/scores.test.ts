import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_SCORES_FILE = path.join(os.tmpdir(), `type-blitz-test-scores-${Date.now()}.json`);
process.env.TYPE_BLITZ_SCORES_FILE = TEST_SCORES_FILE;

import { saveHighScore, loadHighScores, qualifiesForHighScore, MAX_HIGH_SCORES } from '../storage/highScores.js';

function runHighScoresTests() {
  console.log('🧪 Running High Scores & Initials Verification Tests...\n');

  try {
    // Test qualifying check
    assert.strictEqual(qualifiesForHighScore(0), false);
    assert.strictEqual(qualifiesForHighScore(50), true);

    // Test saving score with initials
    const record = saveHighScore({
      initials: 'CYB',
      passageTitle: 'Moby-Dick',
      author: 'Herman Melville',
      wpm: 120,
      accuracy: 99,
      grade: 'S+'
    });

    assert.strictEqual(record.initials, 'CYB');
    assert.strictEqual(record.wpm, 120);

    const scores = loadHighScores();
    assert.ok(scores.length <= MAX_HIGH_SCORES, `High scores list must strictly keep top ${MAX_HIGH_SCORES} max`);
    assert.strictEqual(scores[0].initials, 'CYB');

    console.log('✅ High Scores & Initials Tests PASSED!\n');
  } finally {
    if (fs.existsSync(TEST_SCORES_FILE)) {
      fs.unlinkSync(TEST_SCORES_FILE);
    }
  }
}

runHighScoresTests();
