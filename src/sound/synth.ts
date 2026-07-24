import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SAMPLE_RATE = 22050; // 22.05 kHz 16-bit mono for crisp retro 80s chiptune sound

export const SOUND_DIR = path.join(os.homedir(), '.cache', 'type-blitz', 'sounds');

function createWavHeader(dataSize: number): Buffer {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function squareWave(freq: number, t: number): number {
  return Math.sin(2 * Math.PI * freq * t) >= 0 ? 0.6 : -0.6;
}

function sawtoothWave(freq: number, t: number): number {
  return 2 * (t * freq - Math.floor(t * freq + 0.5));
}

function triangleWave(freq: number, t: number): number {
  return 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1;
}

function noise(): number {
  return Math.random() * 2 - 1;
}

export function generateAllSynthSounds(): void {
  if (!fs.existsSync(SOUND_DIR)) {
    fs.mkdirSync(SOUND_DIR, { recursive: true });
  }

  // 1. Error Sound (80s Arcade Buzz / Damage Drop)
  generateSound('error.wav', 0.14, (t) => {
    const freq = 180 - t * 800; // Pitch drop 180Hz -> 60Hz
    const env = Math.max(0, 1 - t / 0.14);
    const sq = squareWave(Math.max(40, freq), t);
    const n = noise() * 0.3;
    return (sq * 0.7 + n) * env * 0.5;
  });

  // 2. Keypress Sound (80s Soft Synth Click)
  generateSound('keypress.wav', 0.025, (t) => {
    const freq = 1200 + t * 4000;
    const env = Math.max(0, 1 - t / 0.025);
    return squareWave(freq, t) * env * 0.18;
  });

  // 3. Countdown Beep (80s Arcade Coin / Tick)
  generateSound('countdown.wav', 0.09, (t) => {
    const freq = t < 0.04 ? 440 : 880;
    const env = Math.max(0, 1 - t / 0.09);
    return (squareWave(freq, t) * 0.5 + triangleWave(freq / 2, t) * 0.3) * env * 0.4;
  });

  // 4. Top 1 Victory Cheer / Fanfare (80s Winner Arpeggio + Noise Cheer)
  generateSound('victory_top1.wav', 2.2, (t) => {
    const env = Math.min(1, t / 0.1) * Math.max(0, 1 - t / 2.2);
    const arpNotes = [523.25, 659.25, 784.00, 1046.50, 1318.51];
    let sample = 0;

    if (t < 0.8) {
      const step = Math.floor(t * 12) % arpNotes.length;
      sample = squareWave(arpNotes[step], t) * 0.6;
    } else {
      const chord = squareWave(523.25, t) * 0.3 + squareWave(659.25, t) * 0.3 + squareWave(1046.50, t) * 0.3;
      const cheerNoise = noise() * (0.2 + 0.1 * Math.sin(t * 20));
      sample = chord + cheerNoise;
    }
    return sample * env * 0.5;
  });

  // 5. Top 10 High Score Applause / Fanfare
  generateSound('victory_top10.wav', 1.6, (t) => {
    const env = Math.max(0, 1 - t / 1.6);
    const arpNotes = [392.00, 523.25, 659.25, 784.00];
    let sample = 0;
    if (t < 0.6) {
      const step = Math.floor(t * 8) % arpNotes.length;
      sample = squareWave(arpNotes[step], t) * 0.5;
    } else {
      const chord = triangleWave(523.25, t) * 0.4 + squareWave(659.25, t) * 0.3;
      const clapNoise = noise() * (Math.sin(t * 30) > 0.5 ? 0.25 : 0.05);
      sample = chord + clapNoise;
    }
    return sample * env * 0.4;
  });

  // 6. Intense Focus Gameplay Music Track ("Street Fighter Arcade Zone")
  // 60 Seconds seamless repeating 130 BPM energetic track
  generateSound('gameplay_focus.wav', 60.0, (t) => {
    const bpm = 135;
    const sixteenth = (60 / bpm) / 4;
    const currentStep = Math.floor(t / sixteenth);

    // 80s Driving Bassline (A2, A2, C3, D3, A2, A2, G2, A2)
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 98, 110];
    const bassFreq = bassNotes[Math.floor(currentStep / 4) % bassNotes.length];
    const stepTime = t % sixteenth;
    const bassEnv = Math.max(0, 1 - (stepTime / sixteenth) * 0.85);
    const bassSample = (sawtoothWave(bassFreq, t) * 0.45 + squareWave(bassFreq / 2, t) * 0.4) * bassEnv;

    // Arpeggio Lead (A4, C5, E5, A5, G5, E5, C5, G4)
    const arpNotes = [440, 523.25, 659.25, 880, 784, 659.25, 523.25, 392];
    const leadFreq = arpNotes[currentStep % arpNotes.length];
    const leadEnv = Math.max(0, 1 - (stepTime / sixteenth) * 0.6);
    const leadSample = squareWave(leadFreq, t) * 0.25 * leadEnv;

    // 8-bit Percussion (Hat on 16ths, Snare on beats 2 & 4)
    let drumSample = 0;
    const isSnare = currentStep % 8 === 4;
    if (isSnare) {
      const snareEnv = Math.max(0, 1 - ((t % (sixteenth * 2)) / (sixteenth * 2)));
      drumSample += noise() * snareEnv * 0.25;
    } else if (currentStep % 2 === 0) {
      const hatEnv = Math.max(0, 1 - (stepTime / sixteenth) * 2);
      drumSample += noise() * hatEnv * 0.1;
    }

    return (bassSample + leadSample + drumSample) * 0.4;
  });

  // 7. Chill Synthwave Menu Music Track
  // 60 Seconds seamless repeating 90 BPM relaxed track
  generateSound('menu_chill.wav', 60.0, (t) => {
    const bpm = 90;
    const eighth = (60 / bpm) / 2;
    const currentStep = Math.floor(t / eighth);

    // Chord progression: Am (220) -> F (174.61) -> C (261.63) -> G (196)
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [261.63, 329.63, 392], // C
      [196, 246.94, 293.66]  // G
    ];
    const chordIdx = Math.floor(currentStep / 4) % chords.length;
    const activeChord = chords[chordIdx];

    // Soft synth pad
    const pad = (
      triangleWave(activeChord[0] / 2, t) * 0.3 +
      triangleWave(activeChord[1], t) * 0.25 +
      triangleWave(activeChord[2], t) * 0.25
    );

    // Chill arp
    const arpFreq = activeChord[currentStep % activeChord.length];
    const stepTime = t % eighth;
    const arpEnv = Math.max(0, 1 - (stepTime / eighth) * 0.7);
    const arp = triangleWave(arpFreq * 2, t) * 0.15 * arpEnv;

    return (pad + arp) * 0.35;
  });
}

function generateSound(filename: string, durationSec: number, sampleGen: (t: number) => number): void {
  const filePath = path.join(SOUND_DIR, filename);
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const dataSize = numSamples * 2;
  const header = createWavHeader(dataSize);
  const buffer = Buffer.alloc(44 + dataSize);
  header.copy(buffer, 0);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const val = sampleGen(t);
    const clamped = Math.max(-1, Math.min(1, val));
    buffer.writeInt16LE(Math.floor(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}
