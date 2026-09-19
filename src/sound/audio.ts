import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { ANSI } from '../renderer/ansi.js';
import { SOUND_DIR, generateAllSynthSounds } from './synth.js';

type MusicType = 'NONE' | 'MENU' | 'GAMEPLAY';
type AudioCommandInput =
  | { type: 'play'; playbackId: string; asset: string; loop: boolean }
  | { type: 'stop'; playbackId?: string };
type AudioCommand = AudioCommandInput & { sequence: number };

const AUDIO_FD_ENV = 'TYPE_BLITZ_AUDIO_FD';
const localEffects = new Set<ChildProcess>();
let currentMusicProcess: ChildProcess | null = null;
let currentMusicType: MusicType = 'NONE';
let musicGeneration = 0;
let synthSoundsInitialized = false;
let synthSoundInitializationFailed = false;
let commandSequence = 0;
let browserAudioAvailable = true;

function ensureSounds(): boolean {
  if (synthSoundsInitialized) return true;
  if (synthSoundInitializationFailed) return false;
  try {
    generateAllSynthSounds();
    synthSoundsInitialized = true;
    return true;
  } catch {
    synthSoundInitializationFailed = true;
    return false;
  }
}

function browserAudioFd(): number | undefined {
  const value = process.env[AUDIO_FD_ENV];
  if (!value || !/^\d+$/.test(value)) return undefined;
  const fd = Number(value);
  return fd >= 3 ? fd : undefined;
}

function sendBrowserCommand(command: AudioCommandInput): boolean {
  const fd = browserAudioFd();
  if (fd === undefined || !browserAudioAvailable) return false;
  try {
    const message = { sequence: ++commandSequence, ...command } as AudioCommand;
    fs.writeSync(fd, `${JSON.stringify(message)}\n`);
    return true;
  } catch {
    browserAudioAvailable = false;
    return false;
  }
}

const PLAYERS = [
  { command: 'pw-play', args: (file: string) => [file] },
  { command: 'paplay', args: (file: string) => [file] },
  { command: 'aplay', args: (file: string) => ['-q', file] }
];

function spawnLocalPlayer(filePath: string, onSpawn: (child: ChildProcess) => void, onDone: () => void, playerIndex = 0): void {
  const player = PLAYERS[playerIndex];
  if (!player) {
    onDone();
    return;
  }

  const child = spawn(player.command, player.args(filePath), { stdio: 'ignore' });
  let spawned = false;
  child.once('spawn', () => {
    spawned = true;
    onSpawn(child);
  });
  child.once('error', () => {
    if (!spawned) spawnLocalPlayer(filePath, onSpawn, onDone, playerIndex + 1);
    else onDone();
  });
  child.once('exit', () => {
    if (spawned) onDone();
  });
}

function playOneShot(filename: string): void {
  if (!ensureSounds()) return;
  if (browserAudioFd() !== undefined) {
    sendBrowserCommand({ type: 'play', playbackId: `effect-${commandSequence + 1}`, asset: filename, loop: false });
    return;
  }

  spawnLocalPlayer(
    path.join(SOUND_DIR, filename),
    child => localEffects.add(child),
    () => {
      for (const child of localEffects) {
        if (child.exitCode !== null || child.killed) localEffects.delete(child);
      }
    }
  );
}

function startLocalMusic(filename: string, generation: number): void {
  if (generation !== musicGeneration || currentMusicType === 'NONE') return;
  spawnLocalPlayer(
    path.join(SOUND_DIR, filename),
    child => {
      if (generation !== musicGeneration || currentMusicType === 'NONE') {
        child.kill('SIGTERM');
        return;
      }
      currentMusicProcess = child;
    },
    () => {
      if (generation === musicGeneration && currentMusicType !== 'NONE') {
        currentMusicProcess = null;
        setTimeout(() => startLocalMusic(filename, generation), 25).unref();
      }
    }
  );
}

function startMusic(type: Exclude<MusicType, 'NONE'>, filename: string, enabled: boolean): void {
  if (!enabled) {
    stopMusic();
    return;
  }
  if (currentMusicType === type) return;

  stopMusic();
  if (!ensureSounds()) return;
  currentMusicType = type;
  const generation = musicGeneration;
  if (browserAudioFd() !== undefined) {
    sendBrowserCommand({ type: 'play', playbackId: 'music', asset: filename, loop: true });
    return;
  }
  startLocalMusic(filename, generation);
}

export function playBeep(enabled: boolean = true): void {
  if (!enabled) return;
  process.stdout.write(ANSI.beep);
  playOneShot('error.wav');
}

export function playKeypressSound(enabled: boolean = true): void {
  if (enabled) playOneShot('keypress.wav');
}

export function playCountdownBeep(enabled: boolean = true): void {
  if (!enabled) return;
  process.stdout.write(ANSI.beep);
  playOneShot('countdown.wav');
}

export function playTop1Cheer(enabled: boolean = true): void {
  if (enabled) playOneShot('victory_top1.wav');
}

export function playTop10Applause(enabled: boolean = true): void {
  if (enabled) playOneShot('victory_top10.wav');
}

export function stopMusic(): void {
  const hadMusic = currentMusicType !== 'NONE';
  currentMusicType = 'NONE';
  musicGeneration += 1;
  if (currentMusicProcess) {
    currentMusicProcess.kill('SIGTERM');
    currentMusicProcess = null;
  }
  if (hadMusic) sendBrowserCommand({ type: 'stop', playbackId: 'music' });
}

export function stopAllAudio(): void {
  stopMusic();
  for (const child of localEffects) child.kill('SIGTERM');
  localEffects.clear();
  sendBrowserCommand({ type: 'stop' });
}

export function startMenuMusic(enabled: boolean = true): void {
  startMusic('MENU', 'menu_chill.wav', enabled);
}

export function startGameplayMusic(enabled: boolean = true): void {
  startMusic('GAMEPLAY', 'gameplay_focus.wav', enabled);
}
