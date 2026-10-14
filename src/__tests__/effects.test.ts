import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { GameEngine } from '../engine/gameEngine.js';
import { TypingEffects, BURN_MS, FLAME_ROWS, renderEffectCharacter } from '../renderer/typingEffects.js';
import { EffectPainter } from '../renderer/effectPixels.js';
import { KittyEffects, encodeKittyBitmap, kittyGraphicsEnabled } from '../renderer/kittyEffects.js';
import { renderStreamView } from '../renderer/streamView.js';
import { stripAnsi, visibleWidth } from '../renderer/displayWidth.js';

const passage = { id: 'effects', title: 'Effects', author: 'Test', genre: 'Test', year: 2026,
  text: 'Hello there. This passage is long enough to test a fast stream of burning letters.' };
const engine = new GameEngine(passage);
const effects = new TypingEffects();
engine.start();
const type = (char: string, time: number) => {
  const index = engine.typedInput.length;
  engine.handleKey(char); effects.record(index, time);
};

type('H', 100);
const ignition = effects.sample(engine, 80, 100)[0];
assert.equal(ignition.age, 0);
assert.equal(ignition.progress, 0);
assert.equal(ignition.column, 38);
assert.equal(ignition.frozen, false);
assert.ok(effects.sample(engine, 80, 700)[0].progress > 0);
assert.equal(effects.sample(engine, 80, 100 + BURN_MS)[0].progress, 1);
assert.equal(stripAnsi(renderEffectCharacter(effects.sample(engine, 80, 1800)[0])), ' ');

// The entire error cascade freezes, including a key matching the expected letter.
type('x', 1800); type('l', 1900);
const frozen = effects.sample(engine, 80, 10000);
assert.equal(frozen[1].frozen, true);
assert.equal(frozen[2].frozen, true);
assert.equal(frozen[1].progress, 0);
assert.equal(frozen[1].char, 'x');
engine.handleBackspace(); effects.rewind(engine.typedInput.length);
assert.equal(effects.sample(engine, 80, 10000).length, 2);
engine.handleBackspace(); effects.rewind(engine.typedInput.length);
assert.equal(engine.errorIndex, -1);
assert.equal(effects.sample(engine, 80, 10000).length, 1);
type('e', 11000);
assert.equal(effects.sample(engine, 80, 11000)[1].progress, 0, 'correction gets a fresh burn');
assert.equal(effects.sample(engine, 80, 11000)[0].progress, 1, 'rewind must not resurrect old ashes');
engine.handleBackspace(); effects.rewind(engine.typedInput.length);
assert.equal(effects.sample(engine, 80, 11100).length, 1, 'deleted glyph has no residual effects');

engine.start(); effects.reset();
assert.deepEqual(effects.sample(engine, 80, 12000), []);
for (const char of passage.text.slice(0, 25)) type(char, 12000);
const fast = effects.sample(engine, 40, 12000);
assert.equal(fast.length, 19, 'only visible typed columns are painted');
assert.ok(fast.slice(0, 3).every(cell => cell.progress === 1), 'burn finishes before reaching the edge');
const edgeProgress = fast[3].progress;
engine.handleBackspace(); effects.rewind(engine.typedInput.length);
assert.ok(effects.sample(engine, 80, 12000).find(cell => cell.index === fast[3].index)!.progress >= edgeProgress);

const painter = new EffectPainter();
const size = { width: 12, height: 24 };
const burningCell = { ...ignition, column: 4, age: 300, progress: 0.18 };
const burning = painter.paint([burningCell], 12, size, 400);
assert.equal(burning.width, 144);
assert.equal(burning.height, (FLAME_ROWS + 1) * 24);
assert.equal(burning.pixels.length, burning.width * burning.height * 4);
assert.ok(burning.pixels.subarray(0, burning.width * FLAME_ROWS * size.height * 4).some(value => value > 0), 'flames rise above text');
assert.deepEqual(painter.paint([burningCell], 12, size, 400), burning, 'deterministic at a given time');
assert.notDeepEqual(painter.paint([burningCell], 12, size, 500).pixels, burning.pixels, 'flames animate while idle');
assert.ok(painter.paint([{ ...burningCell, progress: 1 }], 12, size, 2000).pixels.every(value => value === 0), 'fully burned letter is completely transparent');
const ice = painter.paint([{ ...burningCell, frozen: true, age: 8000 }], 12, size, 8000);
const iceOffset = ((FLAME_ROWS * size.height) * ice.width + burningCell.column * size.width) * 4;
assert.ok(ice.pixels[iceOffset + 2] > ice.pixels[iceOffset], 'ice has a cold blue rim');
assert.ok(ice.pixels[iceOffset + 3] > 200, 'ice remains solid, never burns out');
assert.ok(painter.paint([], 12, size, 0).pixels.every(value => value === 0));

// Protocol round trip with incompressible data forces multiple 4096-byte chunks.
const bitmap = { width: 96, height: 48, pixels: randomBytes(96 * 48 * 4) };
const encoded = encodeKittyBitmap(bitmap, 12345);
const packets = [...encoded.matchAll(/\x1b_G([^;]+);([^\x1b]*)\x1b\\/g)];
assert.ok(packets.length > 1);
assert.ok(packets[0][1].includes('a=T,p=1,C=1,z=1,i=12345'));
assert.ok(packets.every(packet => packet[1].includes('q=2')), 'terminal responses cannot leak into typed input');
assert.ok(packets.every(packet => packet[2].length <= 4096));
assert.ok(packets.slice(0, -1).every(packet => packet[1].includes('m=1') && packet[2].length % 4 === 0));
assert.equal(packets.at(-1)![1].split(',').at(-1), 'm=0');
assert.deepEqual(inflateSync(Buffer.from(packets.map(packet => packet[2]).join(''), 'base64')), bitmap.pixels);

assert.equal(kittyGraphicsEnabled({ TERM: 'xterm-kitty' }, true), true);
assert.equal(kittyGraphicsEnabled({ KITTY_WINDOW_ID: '1', TERM: 'xterm-256color' }, true), true);
assert.equal(kittyGraphicsEnabled({ KITTY_WINDOW_ID: '1', TYPE_BLITZ_AUDIO_FD: '3' }, true), false);
assert.equal(kittyGraphicsEnabled({ TERM: 'xterm-kitty', TMUX: 'test' }, true), false);
assert.equal(kittyGraphicsEnabled({ TERM: 'xterm-kitty', TYPE_BLITZ_EFFECTS: 'ansi' }, true), false);
assert.equal(kittyGraphicsEnabled({ TYPE_BLITZ_EFFECTS: 'kitty' }, true), true);
assert.equal(kittyGraphicsEnabled({ TYPE_BLITZ_EFFECTS: 'kitty' }, false), false);
const disabled = new KittyEffects(false);
assert.equal(disabled.draw([burningCell], 12, 1, 400), '');
assert.equal(disabled.clear(), '');
const graphics = new KittyEffects(true);
assert.ok(graphics.draw([burningCell], 12, 1, 400).includes('a=T'));
const cleared = graphics.clear();
assert.match(cleared, /a=d,d=I,i=\d+,q=2/, 'cleanup frees only our image');
assert.equal(graphics.clear(), '', 'cleanup is idempotent');
assert.ok(graphics.draw([burningCell], 12, 2, 450).includes('a=T'));
assert.ok(graphics.draw([], 12, 2, 2500).includes('a=d,d=I'), 'last burn removes the placement');

const originalColumns = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
try {
  for (const columns of [2, 20, 40, 60, 80, 120]) {
    Object.defineProperty(process.stdout, 'columns', { value: columns, configurable: true });
    const cells = effects.sample(engine, columns, 12500);
    for (const kitty of [false, true]) {
      const view = renderStreamView(engine, { cells, kitty, now: 12500 });
      assert.equal(view.length, 10);
      for (const line of view) assert.equal(visibleWidth(line), columns);
      if (kitty && columns > 2) {
        const stream = stripAnsi(view[3 + FLAME_ROWS]);
        assert.ok(stream.slice(1, 1 + Math.floor((columns - 2) / 2)).trim().length === 0, 'typed glyphs belong to graphics layer');
        assert.equal(stream[1 + Math.floor((columns - 2) / 2)], passage.text[engine.typedInput.length], 'untyped text stays at the target');
      }
    }
  }
} finally {
  if (originalColumns) Object.defineProperty(process.stdout, 'columns', originalColumns);
  else Reflect.deleteProperty(process.stdout, 'columns');
}
console.log('✅ Fire/ice timeline, pixels, Kitty protocol, cleanup and layout tests passed.');
