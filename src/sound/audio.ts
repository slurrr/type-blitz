import { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { ANSI } from '../renderer/ansi.js';
import { SOUND_DIR, generateAllSynthSounds } from './synth.js';

const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node && typeof window === 'undefined';

let currentMusicProcess: ChildProcess | null = null;
let currentMusicType: 'NONE' | 'MENU' | 'GAMEPLAY' = 'NONE';
let synthSoundsInitialized = false;

function ensureSounds(): void {
  if (!isNode) return;
  if (!synthSoundsInitialized) {
    try {
      generateAllSynthSounds();
      synthSoundsInitialized = true;
    } catch {
      // Ignore generation error
    }
  }
}

function playWavFile(filename: string): void {
  if (!isNode) return;
  ensureSounds();
  try {
    const { exec } = require('node:child_process');
    const filePath = path.join(SOUND_DIR, filename);
    const cmd = `(pw-play "${filePath}" || paplay "${filePath}" || aplay -q "${filePath}") 2>/dev/null &`;
    exec(cmd, () => {});
  } catch {
    // Ignore
  }
}

export function playBeep(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    if (isNode && process.stdout) {
      process.stdout.write(ANSI.beep);
    }
    playWavFile('error.wav');
  } catch {
    // Ignore
  }
}

export function playKeypressSound(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    playWavFile('keypress.wav');
  } catch {
    // Ignore
  }
}

export function playCountdownBeep(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    if (isNode && process.stdout) {
      process.stdout.write(ANSI.beep);
    }
    playWavFile('countdown.wav');
  } catch {
    // Ignore
  }
}

export function playTop1Cheer(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    playWavFile('victory_top1.wav');
  } catch {
    // Ignore
  }
}

export function playTop10Applause(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    playWavFile('victory_top10.wav');
  } catch {
    // Ignore
  }
}

export function stopMusic(): void {
  if (!isNode) return;
  currentMusicType = 'NONE';
  if (currentMusicProcess && currentMusicProcess.pid) {
    try {
      process.kill(-currentMusicProcess.pid, 'SIGKILL');
    } catch {
      try {
        currentMusicProcess.kill('SIGKILL');
      } catch {
        // Ignore
      }
    }
    currentMusicProcess = null;
  }

  try {
    const { execSync } = require('node:child_process');
    execSync('pkill -9 -f "menu_chill.wav" 2>/dev/null || true');
    execSync('pkill -9 -f "gameplay_focus.wav" 2>/dev/null || true');
  } catch {
    // Ignore
  }
}

export function startMenuMusic(enabled: boolean = true): void {
  if (!isNode || !enabled) {
    stopMusic();
    return;
  }
  if (currentMusicType === 'MENU') return;
  stopMusic();
  currentMusicType = 'MENU';

  ensureSounds();
  try {
    const { spawn } = require('node:child_process');
    const menuWav = path.join(SOUND_DIR, 'menu_chill.wav');
    currentMusicProcess = spawn('sh', ['-c', `while true; do (pw-play "${menuWav}" || paplay "${menuWav}" || aplay -q "${menuWav}"); done`], {
      detached: true,
      stdio: 'ignore'
    });
  } catch {
    // Ignore
  }
}

export function startGameplayMusic(enabled: boolean = true): void {
  if (!isNode || !enabled) {
    stopMusic();
    return;
  }
  if (currentMusicType === 'GAMEPLAY') return;
  stopMusic();
  currentMusicType = 'GAMEPLAY';

  ensureSounds();
  try {
    const { spawn } = require('node:child_process');
    const gameplayWav = path.join(SOUND_DIR, 'gameplay_focus.wav');
    currentMusicProcess = spawn('sh', ['-c', `while true; do (pw-play "${gameplayWav}" || paplay "${gameplayWav}" || aplay -q "${gameplayWav}"); done`], {
      detached: true,
      stdio: 'ignore'
    });
  } catch {
    // Ignore
  }
}
