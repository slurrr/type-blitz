import { GameEngine } from '../engine/gameEngine.js';

export const FLAME_ROWS = 3;
export const FLAME_MS = 1600;
export const EMBER_MS = 360;
export const CRUMBLE_MS = 1400;
export const BURN_MS = FLAME_MS + EMBER_MS + CRUMBLE_MS;
export const EFFECT_FPS = 30;

/** Use effective progress (including edge acceleration), not wall time, for every phase. */
export function burnPhases(progress: number): { flame: number; crumble: number } {
  const elapsed = Math.max(0, Math.min(1, progress)) * BURN_MS;
  return {
    flame: Math.min(1, elapsed / FLAME_MS),
    crumble: Math.max(0, Math.min(1, (elapsed - FLAME_MS - EMBER_MS) / CRUMBLE_MS))
  };
}

export interface EffectCell {
  column: number;
  index: number;
  char: string;
  frozen: boolean;
  age: number;
  progress: number;
}

/** Presentation-only history: no changes to scoring, error cascades or passage text. */
export class TypingEffects {
  private births: Array<{ time: number; progress: number }> = [];

  record(index: number, now = performance.now()): void {
    this.births.length = index;
    this.births.push({ time: now, progress: 0 });
  }

  rewind(length: number): void {
    this.births.length = Math.min(length, this.births.length);
  }

  reset(): void {
    this.births = [];
  }

  sample(engine: GameEngine, columns: number, now = performance.now()): EffectCell[] {
    const center = Math.floor(Math.max(0, columns - 2) / 2);
    const active = engine.typedInput.length;
    const cells: EffectCell[] = [];
    for (let index = Math.max(0, active - center); index < active; index++) {
      const birth = this.births[index];
      const age = birth ? Math.max(0, now - birth.time) : 0;
      const frozen = engine.errorIndex !== -1 && index >= engine.errorIndex;
      // Speed up the burn near the left edge, even for a burst of very fast typing.
      // Remember progress so backspacing cannot resurrect an already burned glyph.
      const progress = frozen ? 0 : Math.min(1, Math.max(
        birth?.progress ?? 0, age / BURN_MS,
        (active - index - 1) / Math.max(1, center - 3)
      ));
      if (birth) birth.progress = progress;
      cells.push({ column: center + index - active, index,
        char: frozen ? engine.typedInput[index] : engine.passage.text[index] ?? ' ',
        frozen, age, progress });
    }
    return cells;
  }
}

const foreground = (r: number, g: number, b: number, text: string) =>
  `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;

/** Low-cost text rendering when graphics are unavailable (also useful over a browser PTY). */
export function renderEffectCharacter(cell: EffectCell): string {
  if (cell.frozen) return `\x1b[48;2;37;91;130m\x1b[38;2;204;249;255m${cell.char === ' ' ? '·' : cell.char}\x1b[0m`;
  if (cell.progress >= 1) return ' ';
  const { flame, crumble } = burnPhases(cell.progress);
  if (crumble > 0.7) return foreground(123, 57, 38, '·');
  if (crumble > 0.25) return foreground(206, 45, 81, '░');
  if (flame >= 1) return foreground(255, 91, 38, cell.char);
  return foreground(255, Math.round(235 - flame * 130), 90, cell.char);
}

export function renderTextFlames(cells: EffectCell[], width: number, now: number): string[] {
  const rows = Array.from({ length: FLAME_ROWS }, () => Array<string>(width).fill(' '));
  for (const cell of cells) {
    if (cell.column < 0 || cell.column >= width) continue;
    if (cell.frozen) {
      rows[FLAME_ROWS - 1][cell.column] = foreground(133, 226, 255, '▔');
    } else if (burnPhases(cell.progress).flame < 1) {
      const phase = Math.floor(now / 90) + cell.index * 7;
      const height = Math.ceil((1 - burnPhases(cell.progress).flame) * (2 + Math.sin(phase) * 0.8));
      for (let y = 0; y < Math.min(FLAME_ROWS, height); y++) {
        rows[FLAME_ROWS - 1 - y][cell.column] = foreground(255, 170 - y * 58, 20,
          ['⡀', '⣆', '⡄', '⢀'][(phase + y) % 4]);
      }
    }
  }
  return rows.map(row => row.join(''));
}
