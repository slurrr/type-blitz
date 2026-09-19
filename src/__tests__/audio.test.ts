import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function runAudioTests() {
  console.log('🧪 Running Audio Boundary Tests...\n');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'type-blitz-audio-'));
  const commandFile = path.join(root, 'commands.ndjson');
  const fd = fs.openSync(commandFile, 'w');
  process.env.TYPE_BLITZ_SOUND_DIR = path.join(root, 'sounds');
  process.env.TYPE_BLITZ_AUDIO_FD = String(fd);

  const audio = await import('../sound/audio.js');
  audio.startMenuMusic(true);
  audio.startMenuMusic(true);
  audio.playKeypressSound(true);
  audio.startGameplayMusic(true);
  audio.stopAllAudio();
  fs.closeSync(fd);

  const commands = fs.readFileSync(commandFile, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepStrictEqual(commands.map(command => command.sequence), commands.map((_, index) => index + 1));
  assert.strictEqual(commands.filter(command => command.type === 'play' && command.asset === 'menu_chill.wav').length, 1);
  assert.ok(commands.some(command => command.type === 'play' && command.asset === 'keypress.wav' && command.loop === false));
  assert.ok(commands.some(command => command.type === 'play' && command.asset === 'gameplay_focus.wav' && command.loop === true));
  assert.ok(commands.some(command => command.type === 'stop' && command.playbackId === undefined));

  for (const command of commands.filter(command => command.type === 'play')) {
    assert.strictEqual(path.basename(command.asset), command.asset);
    const wav: Buffer = fs.readFileSync(path.join(process.env.TYPE_BLITZ_SOUND_DIR!, String(command.asset)));
    assert.strictEqual(wav.subarray(0, 4).toString(), 'RIFF');
    assert.strictEqual(wav.subarray(8, 12).toString(), 'WAVE');
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('✅ Audio Boundary Tests PASSED!\n');
}

runAudioTests();
