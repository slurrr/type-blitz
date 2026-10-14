import { createCanvas } from '@napi-rs/canvas';
import { EffectCell, FLAME_ROWS } from './typingEffects.js';

export interface EffectBitmap { width: number; height: number; pixels: Buffer }
export interface CellSize { width: number; height: number }

function hash(n: number): number {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix + iy * 157 + seed), b = hash(ix + 1 + iy * 157 + seed);
  const c = hash(ix + (iy + 1) * 157 + seed), d = hash(ix + 1 + (iy + 1) * 157 + seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Cached glyph masks let us actually erode letter shapes, not just dim terminal text. */
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
    // Keep memory bounded across repeated window/font resizes and custom passages.
    if (this.masks.size >= 512) this.masks.clear();
    this.masks.set(key, mask);
    return mask;
  }

  paint(cells: EffectCell[], columns: number, size: CellSize, now: number): EffectBitmap {
    const cw = size.width, ch = size.height;
    const width = Math.max(1, columns * cw), height = (FLAME_ROWS + 1) * ch;
    const pixels = Buffer.alloc(width * height * 4);
    const baseline = FLAME_ROWS * ch;
    const time = now / 1000;
    const blend = (x: number, y: number, r: number, g: number, b: number, alpha: number) => {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || x >= width || y < 0 || y >= height || alpha <= 0) return;
      const offset = (y * width + x) * 4;
      const a = Math.min(1, alpha / 255), old = pixels[offset + 3] / 255;
      const out = a + old * (1 - a);
      pixels[offset] = (r * a + pixels[offset] * old * (1 - a)) / out;
      pixels[offset + 1] = (g * a + pixels[offset + 1] * old * (1 - a)) / out;
      pixels[offset + 2] = (b * a + pixels[offset + 2] * old * (1 - a)) / out;
      pixels[offset + 3] = out * 255;
    };

    for (const cell of cells) {
      if (cell.column < 0 || cell.column >= columns || (!cell.frozen && cell.progress >= 1)) continue;
      const x0 = cell.column * cw;
      const seed = cell.index * 23;
      if (cell.frozen) {
        // Bevelled translucent ice, diagonal facets and stable branching cracks.
        for (let y = -Math.max(2, Math.round(ch * 0.12)); y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const edge = x === 0 || x === cw - 1 || y === -Math.max(2, Math.round(ch * 0.12)) || y === ch - 1;
            const facet = (x / cw + y / ch * 0.65 + hash(seed)) % 1;
            const crackX = cw * (0.5 + 0.22 * Math.sin(y * 0.32 + seed));
            const crack = Math.abs(x - crackX) < 0.65 || Math.abs(x - (crackX + (y - ch * 0.45) * 0.8)) < 0.45;
            const glint = 0.5 + 0.5 * Math.sin(time * 2 + seed);
            blend(x0 + x, baseline + y,
              edge || crack ? 175 + glint * 60 : 34 + facet * 54,
              edge || crack ? 235 : 110 + facet * 65,
              edge || crack ? 255 : 174 + facet * 58,
              edge ? 245 : crack ? 205 : 205 + facet * 25);
          }
        }
        // Frost sparkles near the top edge, without a distracting permanent blizzard.
        for (let i = 0; i < 5; i++) {
          const life = Math.min(1, cell.age / 450);
          const x = x0 + hash(seed + i) * cw;
          const y = baseline - 2 - life * ch * hash(seed + i + 50);
          blend(x, y, 212, 249, 255, (1 - life) * 220);
        }
      } else {
        const strength = Math.pow(1 - cell.progress, 0.65);
        const ignition = Math.min(1, 0.3 + cell.age / 100);
        const flameHeight = ch * (1.1 + 1.9 * strength) * ignition;
        const foot = baseline + ch * 0.83;
        const middle = x0 + cw / 2;
        // Continuous turbulent tongues. Noise travels upwards; neighboring letters overlap.
        for (let y = Math.max(0, Math.floor(foot - flameHeight)); y < height; y++) {
          const up = (foot - y) / flameHeight;
          if (up < -0.08 || up > 1) continue;
          const sway = Math.sin(up * 7 - time * 7 + seed) * cw * 0.22 * up;
          const radius = cw * (0.8 - up * 0.55);
          for (let x = Math.floor(middle - cw); x <= middle + cw; x++) {
            const side = Math.abs(x - middle - sway) / radius;
            const turbulence = noise(x / (cw * 0.4), y / (ch * 0.28) + time * 8, seed);
            const heat = (1 - side * side) * (1 - up) + (turbulence - 0.45) * 0.7;
            if (heat <= 0.06) continue;
            const hot = Math.min(1, heat);
            blend(x, y, 255, Math.min(255, 38 + hot * 225), Math.max(0, (hot - 0.58) * 390),
              Math.min(230, hot * 400) * strength);
          }
        }
        for (let i = 0; i < 9; i++) {
          const life = (time * (0.65 + hash(seed + i) * 0.5) + hash(seed + i + 19)) % 1;
          const x = middle + Math.sin(life * 6 + seed + i) * cw * (0.3 + life);
          const y = baseline + ch * 0.5 - life * ch * 3.5;
          const a = (1 - life) * strength * 235;
          blend(x, y, 255, 160 + hash(i) * 95, 70, a);
          blend(x, y + 1, 255, 81, 12, a * 0.45);
        }
      }

      const mask = this.glyph(cell.char === ' ' ? '·' : cell.char, size);
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const alpha = mask[(y * cw + x) * 4 + 3];
          if (!alpha) continue;
          if (cell.frozen) {
            blend(x0 + x, baseline + y, 8, 38, 68, alpha);
          } else {
            const erosion = cell.progress < 0.18 ? -1 : (cell.progress - 0.18) / 0.82;
            const threshold = y / ch * 0.6 + noise(x * 0.4, y * 0.3, seed) * 0.4;
            if (threshold < erosion) continue;
            const rim = threshold - erosion < 0.14;
            blend(x0 + x, baseline + y, 255, rim ? 245 : 214 - cell.progress * 100,
              rim ? 193 : 94 - cell.progress * 90, alpha);
          }
        }
      }
    }
    return { width, height, pixels };
  }
}
