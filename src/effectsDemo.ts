import readline from 'node:readline';
import { GameEngine } from './engine/gameEngine.js';
import { ANSI, getTerminalDimensions, renderTerminalFrame } from './renderer/ansi.js';
import { renderHeader, renderFooter } from './renderer/retroHeader.js';
import { renderStreamView } from './renderer/streamView.js';
import { TypingEffects, EFFECT_FPS } from './renderer/typingEffects.js';
import { KittyEffects, FLAME_ROW_OFFSET } from './renderer/kittyEffects.js';

// A no-audio, no-score sandbox. Auto-demo until the first typing/backspace key.
const engine = new GameEngine({ id: 'effects-demo', title: 'Fire & Ice — Effects Lab',
  author: 'TYPE-BLITZ', year: 2026, genre: 'Demo',
  text: 'Fire consumes the letters. Ice remembers every mistake. Keep the words moving. ' });
const effects = new TypingEffects();
const graphics = new KittyEffects();
let automatic = true;
let step = 0;
let next = performance.now() + 800;
let previous: string[] = [];
engine.start();

function type(char: string): void {
  const index = engine.typedInput.length;
  engine.handleKey(char);
  effects.record(index);
}
function backspace(): void {
  if (engine.handleBackspace() === 'erased') effects.rewind(engine.typedInput.length);
}
function reset(): void {
  engine.start(); effects.reset(); step = 0; next = performance.now() + 800;
}
function cleanup(): void {
  clearInterval(timer);
  process.stdout.write(graphics.clear() + ANSI.reset + ANSI.showCursor + '\n');
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.exit(0);
}
function render(): void {
  if (process.stdout.writableLength > 0) return;
  const now = performance.now();
  if (automatic && now >= next) {
    // Burn a phrase; freeze a cascade; hold it; backspace; correctly retype it.
    if (step < 18) type(engine.passage.text[engine.typedInput.length]);
    else if (step < 24) type('frozen'[step - 18]);
    else if (step < 30) backspace();
    else if (step < 55) type(engine.passage.text[engine.typedInput.length]);
    else { reset(); return; }
    step++;
    next = now + (step === 24 ? 2200 : step === 55 ? 1800 : 115);
  }
  const { cols, rows } = getTerminalDimensions();
  const header = renderHeader(engine.passage.title, engine.passage.author);
  const kitty = graphics.enabled && rows >= header.length + 12;
  const cells = effects.sample(engine, cols, now);
  const lines = [...header, ...renderStreamView(engine, { cells, kitty, now }),
    ...renderFooter(`${automatic ? 'AUTO DEMO' : 'TRY IT'} | TYPE / BACKSPACE | CTRL+R REPLAY | ESC EXIT`)];
  let output = previous.length === lines.length ? lines.map((line, index) =>
    line === previous[index] ? '' : ANSI.moveTo(index + 1, 1) + line).join('') : renderTerminalFrame(lines);
  output += kitty ? graphics.draw(cells, Math.floor(Math.max(0, cols - 2) / 2), header.length + FLAME_ROW_OFFSET + 1, now) : graphics.clear();
  previous = lines;
  if (output) process.stdout.write(output);
}

if (process.stdin.isTTY) process.stdin.setRawMode(true);
readline.emitKeypressEvents(process.stdin);
process.stdin.resume();
process.stdin.on('keypress', (str, key: readline.Key) => {
  if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return cleanup();
  if (key.ctrl && key.name === 'r') { automatic = true; reset(); return; }
  if (key.name === 'backspace') { automatic = false; backspace(); }
  else if (str && str.length === 1 && !key.ctrl && !key.meta) {
    if (automatic || engine.isCompleted) reset();
    automatic = false; type(str);
  }
  render();
});
process.stdout.on('resize', () => { graphics.invalidateSize(); previous = []; render(); });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, cleanup);
process.stdout.write(ANSI.hideCursor);
const timer = setInterval(render, 1000 / EFFECT_FPS);
render();
