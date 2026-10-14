import { deflateSync } from 'node:zlib';
import { randomInt } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ANSI, getTerminalDimensions } from './ansi.js';
import { CellSize, EffectBitmap, EffectPainter } from './effectPixels.js';
import { EffectCell, FLAME_ROWS } from './typingEffects.js';

const command = (controls: string, payload = '') => `\x1b_G${controls};${payload}\x1b\\`;

/** Direct, compressed RGBA: no temporary files, subprocesses or terminal replies per frame. */
export function encodeKittyBitmap(bitmap: EffectBitmap, id: number): string {
  const data = deflateSync(bitmap.pixels, { level: 1 }).toString('base64');
  // Replace the one image in place. Editing animation root frames can leave a
  // stale displayed texture in Kitty; transmit-and-place refreshes it reliably.
  const controls = `a=T,p=1,C=1,z=1,i=${id},f=32,s=${bitmap.width},v=${bitmap.height},o=z,q=2`;
  let result = '';
  for (let offset = 0; offset < data.length; offset += 4096) {
    const more = offset + 4096 < data.length ? 1 : 0;
    const head = offset === 0 ? controls : 'q=2';
    result += command(`${head},m=${more}`, data.slice(offset, offset + 4096));
  }
  return result;
}

export function kittyGraphicsEnabled(env = process.env, isTTY = process.stdout.isTTY): boolean {
  if (!isTTY || env.TYPE_BLITZ_EFFECTS === 'ansi') return false;
  if (env.TYPE_BLITZ_EFFECTS === 'kitty') return true;
  // A browser-hosted PTY can inherit KITTY_WINDOW_ID from its parent shell.
  return !env.TMUX && !env.TYPE_BLITZ_AUDIO_FD && !!(env.KITTY_WINDOW_ID || env.TERM?.includes('kitty'));
}

/** Own exactly one image; never clear another application's graphics. */
export class KittyEffects {
  readonly enabled: boolean;
  private id = randomInt(1, 0xffffffff);
  private painter = new EffectPainter();
  private size: CellSize = { width: 10, height: 20 };
  private geometry = '';
  private visible = false;
  private terminalGeometry = '';

  constructor(enabled = kittyGraphicsEnabled()) {
    this.enabled = enabled;
  }

  private measure(): void {
    const { cols, rows } = getTerminalDimensions();
    const geometry = `${cols}:${rows}`;
    if (geometry === this.terminalGeometry) return;
    this.terminalGeometry = geometry;
    // Kitty's helper uses the TTY's pixel dimensions. Only runs on entry/resize,
    // before rendering, never once per animation frame. A bounded fallback keeps
    // --effects-demo usable in synthetic PTYs without a controlling terminal.
    const result = spawnSync('kitten', ['icat', '--print-window-size', '--stdin=no'], {
      encoding: 'utf8', timeout: 700, stdio: ['ignore', 'pipe', 'ignore']
    });
    const match = result.stdout?.trim().match(/^(\d+)x(\d+)$/);
    if (match) {
      const width = Math.floor(Number(match[1]) / cols), height = Math.floor(Number(match[2]) / rows);
      if (width > 0 && width <= 128 && height > 0 && height <= 256) this.size = { width, height };
    }
  }

  invalidateSize(): void {
    this.terminalGeometry = '';
  }

  draw(cells: EffectCell[], columns: number, topRow: number, now: number): string {
    if (!this.enabled) return '';
    if (!cells.some(cell => cell.frozen || cell.progress < 1) || columns < 1) return this.clear();
    this.measure();
    const bitmap = this.painter.paint(cells, columns, this.size, now);
    const geometry = `${bitmap.width}:${bitmap.height}:${topRow}`;
    let output = '';
    if (geometry !== this.geometry) output += this.clear();
    output += ANSI.saveCursor + ANSI.moveTo(topRow, 2);
    output += encodeKittyBitmap(bitmap, this.id);
    // Pixel dimensions exactly match terminal cells: no aspect-ratio letterboxing.
    output += ANSI.restoreCursor;
    this.geometry = geometry;
    this.visible = true;
    return output;
  }

  clear(): string {
    if (!this.visible) return '';
    this.visible = false;
    this.geometry = '';
    return command(`a=d,d=I,i=${this.id},q=2`);
  }
}

// Stats, divider, target marker precede the reserved flame rows in streamView.
export const FLAME_ROW_OFFSET = 3;
export const EFFECT_HEIGHT_ROWS = FLAME_ROWS + 1;
