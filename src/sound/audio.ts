import { spawn, exec, execSync, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { ANSI } from '../renderer/ansi.js';
import { SOUND_DIR, generateAllSynthSounds } from './synth.js';

let currentMusicProcess: ChildProcess | null = null;
let currentMusicType: 'NONE' | 'MENU' | 'GAMEPLAY' = 'NONE';
let synthSoundsInitialized = false;

function ensureSounds(): void {
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
  ensureSounds();
  const filePath = path.join(SOUND_DIR, filename);
  const cmd = `(pw-play "${filePath}" || paplay "${filePath}" || aplay -q "${filePath}") 2>/dev/null &`;
  exec(cmd, () => {});
}

export function playBeep(enabled: boolean = true): void {
  if (!enabled) return;
  try {
    process.stdout.write(ANSI.beep);
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
    process.stdout.write(ANSI.beep);
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
    execSync('pkill -9 -f "menu_chill.wav" 2>/dev/null || true');
    execSync('pkill -9 -f "gameplay_focus.wav" 2>/dev/null || true');
  } catch {
    // Ignore
  }
}

export function startMenuMusic(enabled: boolean = true): void {
  if (!enabled) {
    stopMusic();
    return;
  }
  if (currentMusicType === 'MENU' && currentMusicProcess) return;

  stopMusic();
  ensureSounds();
  currentMusicType = 'MENU';

  const wavPath = path.join(SOUND_DIR, 'menu_chill.wav');
  const loopShellCmd = `while true; do pw-play "${wavPath}" || paplay "${wavPath}" || aplay -q "${wavPath}" || break; done`;

  currentMusicProcess = spawn('bash', ['-c', loopShellCmd], {
    stdio: 'ignore',
    detached: true
  });

  currentMusicProcess.on('exit', () => {
    if (currentMusicType === 'MENU') {
      currentMusicType = 'NONE';
      currentMusicProcess = null;
    }
  });
}

export function startGameplayMusic(enabled: boolean = true): void {
  if (!enabled) {
    stopMusic();
    return;
  }
  if (currentMusicType === 'GAMEPLAY' && currentMusicProcess) return;

  stopMusic();
  ensureSounds();
  currentMusicType = 'GAMEPLAY';

  const wavPath = path.join(SOUND_DIR, 'gameplay_focus.wav');
  const loopShellCmd = `while true; do pw-play "${wavPath}" || paplay "${wavPath}" || aplay -q "${wavPath}" || break; done`;

  currentMusicProcess = spawn('bash', ['-c', loopShellCmd], {
    stdio: 'ignore',
    detached: true
  });

  currentMusicProcess.on('exit', () => {
    if (currentMusicType === 'GAMEPLAY') {
      currentMusicType = 'NONE';
      currentMusicProcess = null;
    }
  });
}
