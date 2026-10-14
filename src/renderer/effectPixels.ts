import { createCanvas } from '@napi-rs/canvas';
import { EffectCell, FLAME_ROWS } from './typingEffects.js';

export interface EffectBitmap { width: number; height: number; pixels: Buffer }
export interface CellSize { width: number; height: number }

type Color = readonly [number, number, number];
// Flat arcade inks, not a temperature gradient. Zero is transparent in sprites.
const FIRE: readonly Color[] = [
  [0, 0, 0], [87, 24, 66], [206, 45, 81], [255, 91, 38], [255, 166, 44], [255, 224, 97], [255, 246, 194]
];
const ICE: readonly Color[] = [
  [12, 34, 76], [29, 78, 144], [42, 133, 188], [66, 203, 227], [174, 249, 255]
];

// Hand-pixelled silhouettes: flick between cels rather than simulating fluid fire.
const FLAMES = [
  ['  2  ', '  3  ', ' 23  ', ' 34  ', ' 343 ', ' 454 ', '24542', '34543', '34543', '34543', '24542', ' 343 ', ' 232 '],
  ['   2 ', '   3 ', '  23 ', '  34 ', ' 343 ', ' 454 ', '24543', '34543', '34543', '34543', '24542', ' 343 ', ' 232 '],
  [' 2   ', ' 3   ', ' 32  ', ' 43  ', ' 343 ', '2454 ', '34542', '34543', '34543', '34543', '24542', ' 343 ', ' 232 '],
  ['     ', '  2  ', '  3  ', ' 232 ', ' 343 ', '24542', '34543', '34543', '34543', '34543', '24542', ' 343 ', ' 232 ']
];

function hash(n: number): number {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Cached glyph masks retain the terminal font's shape, with hard-edged pixel erosion. */
export class EffectPainter {
  private masks = new Map<string, Uint8ClampedArray>();
  constructor(private font = process.env.TYPE_BLITZ_EFFECT_FONT || 'monospace') {}

  private glyph(char: string, size: CellSize): Uint8ClampedArray {
    const key = `${size.width}:${size.height}:${char}`;
    const cached = this.masks.get(key);
    if (cached) return cached;
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    ctx.font = `${Math.round(size.height * 0.78)}px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, size.width / 2, Math.round(size.height * 0.79), size.width * 0.95);
    const mask = ctx.getImageData(0, 0, size.width, size.height).data;
    if (this.masks.size >= 512) this.masks.clear();
    this.masks.set(key, mask);
    return mask;
  }

  paint(cells: EffectCell[], columns: number, size: CellSize, now: number): EffectBitmap {
    const cw = size.width, ch = size.height;
    const width = Math.max(1, columns * cw), height = (FLAME_ROWS + 1) * ch;
    const pixels = Buffer.alloc(width * height * 4);
    const baseline = FLAME_ROWS * ch;
    const block = Math.max(2, Math.round(Math.min(cw / 3, ch / 8)));
    const tick = Math.floor(now / 90);
    const rect = (x: number, y: number, w: number, h: number, color: Color) => {
      const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y));
      const right = Math.min(width, Math.floor(x + w)), bottom = Math.min(height, Math.floor(y + h));
      for (let py = top; py < bottom; py++) {
        for (let px = left; px < right; px++) {
          const offset = (py * width + px) * 4;
          pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
          pixels[offset + 3] = 255;
        }
      }
    };
    const visible = cells.filter(cell => cell.column >= 0 && cell.column < columns && (cell.frozen || cell.progress < 1));

    // Fire first, ice second, glyphs last: neighbors must not paint over a letter or its ice.
    for (const cell of visible.filter(cell => !cell.frozen)) {
      const x0 = cell.column * cw;
      const seed = cell.index * 23;
      const stage = Math.min(3, Math.floor(cell.progress * 4));
      const sprite = FLAMES[(tick + cell.index) % FLAMES.length];
      const ignition = cell.age < 90 ? 0.5 : 1;
      const rows = Math.max(2, Math.round((13 - stage * 3) * ignition));
      const center = Math.round((x0 + cw / 2) / block) * block;
      const foot = baseline + block * 2;
      for (let row = 0; row < rows; row++) {
        const source = sprite[Math.floor(row * sprite.length / rows)];
        for (let col = 0; col < source.length; col++) {
          const ink = Number(source[col]);
          if (!ink) continue;
          // Late stages fragment rather than turning into a smooth transparent glow.
          if (stage === 3 && hash(seed + row * 7 + col) < 0.5) continue;
          rect(center + (col - 2) * block, foot - (rows - row) * block, block, block,
            FIRE[Math.max(1, ink - (stage >= 2 ? 1 : 0))]);
        }
      }
      // A few square embers, stepping upwards on the same coarse sprite grid.
      for (let i = 0; i < 3; i++) {
        const life = (tick + Math.floor(hash(seed + i) * 15)) % 16;
        if (life > 11 - stage * 2 || hash(seed + i + 8) < 0.25) continue;
        const drift = Math.floor(hash(seed + i * 9) * 3) - 1;
        rect(center + drift * block * (1 + Math.floor(life / 5)),
          baseline - (life + 2) * block, block, block, FIRE[life < 5 ? 5 : 2]);
      }
    }

    for (const cell of visible.filter(cell => cell.frozen)) {
      const x0 = cell.column * cw;
      const top = baseline - block;
      // An arcade ice tile: flat blue face, chunky bevel, stair-step crack. No glass shading.
      rect(x0, top, cw, ch + block, ICE[1]);
      rect(x0, top, cw, block, ICE[4]);
      rect(x0, top + block, block, ch - block, ICE[3]);
      rect(x0 + cw - block, top + block, block, ch, ICE[0]);
      rect(x0, baseline + ch - block, cw, block, ICE[0]);
      for (let row = 1; row < Math.ceil(ch / block); row++) {
        const col = (row + cell.index) % Math.max(1, Math.floor(cw / block) - 2);
        rect(x0 + block + col * block, top + row * block, Math.min(block, Math.max(0, cw - block * (col + 2))), block,
          row % 3 === 0 ? ICE[4] : ICE[2]);
      }
      if (cell.age < 360) {
        const lift = Math.floor(cell.age / 90) + 1;
        rect(x0, top - lift * block * 2, block, block, ICE[4]);
      }
    }

    for (const cell of visible) {
      const x0 = cell.column * cw;
      const mask = this.glyph(cell.char === ' ' ? '·' : cell.char, size);
      const erosion = cell.progress < 0.18 ? -1 : (cell.progress - 0.18) / 0.82;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          // Threshold the font mask: no antialiasing or blended colors in the effect layer.
          if (mask[(y * cw + x) * 4 + 3] < 96) continue;
          const gx = Math.floor(x / block), gy = Math.floor(y / block);
          const threshold = gy * block / ch * 0.6 + hash(gx + gy * 17 + cell.index * 23) * 0.4;
          if (!cell.frozen && threshold < erosion) continue;
          const ink = cell.frozen ? ICE[4] : FIRE[threshold - erosion < 0.15 || cell.progress < 0.2 ? 6 : 4];
          rect(x0 + x, baseline + y, 1, 1, ink);
        }
      }
    }
    return { width, height, pixels };
  }
}
