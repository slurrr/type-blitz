# 🕹️ TYPE-BLITZ '84

> An **80s Retro Synthwave Terminal Typing Game** with single-line streaming classic literature passages.

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  _____ _   _ ___ _____ _____ ___ _     ___ _____ _____                                   ║
║ |_   _| | | |  _|_   _|  ___/  _(_)   |_ _|_   _|__  /                                   ║
║   | | | |_| |  _| | | |  |_ |  _| |    | |  | |   / /                                    ║
║   |_|  \___/|_|   |_| |____|_| |_|___ |___| |_|  /____|                                  ║
║ ▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─▲─▼─ ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🌟 Overview & Key Mechanics

**TYPE-BLITZ '84** drops you into an 80s arcade synthwave environment where famous passages of world literature stream across your terminal screen.

### 🕹️ Features:
1. **80s Cyberpunk Aesthetic**: Vibrant neon colors, ASCII arcade titles, retro perspective grid line accents, and optional sound effects.
2. **Animated 3-2-1 Countdown**: Big retro ASCII countdown (`GET READY!` ➔ `3` ➔ `2` ➔ `1` ➔ `GO!`) before every round.
3. **Single-Line Centered Stream**:
   - The passage drops right into the middle of the terminal screen.
   - The first word streamed starts centered at your target line.
   - As you type, the passage streams horizontally leftwards at your exact typing speed!
   - **The active word & character always stay locked in the center!**
4. **Fire & Ice Typing Effects**:
   - Correct letters ignite, erode into embers, and disappear while the stream keeps its spacing.
   - In Kitty, real pixel flames rise into three rows above the text at 30 FPS.
   - Mistakes become cracked blue ice blocks. The whole error cascade stays frozen until you `Backspace` past the mistake.
5. **Classic Literature Database**:
   - Passages from *Moby-Dick*, *1984*, *Pride and Prejudice*, *The Great Gatsby*, *Frankenstein*, *Alice's Adventures in Wonderland*, *The Metamorphosis*, *Dracula*, *Dune*, *Fahrenheit 451*, and more.
   - Custom passage input mode (paste your own text).
6. **Arcade High Scores & Grading**:
   - Calculates Net WPM, Raw WPM, Accuracy %, Max Streak, and Mistakes.
   - Grades your performance (`S+ CYBER GOD`, `A+ SYNTH SPEEDSTER`, `B TURBO TYPIST`, etc.) and records high scores to `~/.config/type-blitz/highscores.json`.

---

## 🚀 Quick Start

### Installation & Launch

Run directly via `npx` / node:

```bash
# Start game
npm start

# Or using executable symlink on PATH
type-blitz
```

### Command Line Options

```bash
# List available literature passages
type-blitz --list

# Start game directly with a specific passage ID (e.g. 1984, moby-dick, dune)
type-blitz --passage 1984
type-blitz --passage dune
```

---

## 🔥 Fire & Ice experiment (Kitty)

Launch normally with `type-blitz` or `npm start`; graphics turn on automatically in a native
Kitty TTY. For a silent sandbox that never writes scores:

```bash
npm run effects:demo
```

The demo automatically burns a phrase, freezes a mistake cascade, backspaces it, and
retypes it. Start typing to take over; `Ctrl+R` replays the demo; `Esc` exits.

- **Burn:** about 1.6 seconds, accelerated near the left edge so fast typing cannot outrun it.
- **Ice:** translucent bevels, facets, cracks and a brief frost burst. It persists until erased.
- **Layout:** flames stay behind the cursor; upcoming text remains native terminal text.
  Burned characters keep their space, and backspacing restores untyped passage text.
- **Implementation:** `@napi-rs/canvas` rasterizes glyph masks; the renderer erodes those
  masks and draws procedural flames/ice. Compressed RGBA goes directly through the
  [Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/), with one
  reusable image ID and no per-frame files or subprocesses. `kitten icat --print-window-size`
  measures cell pixels on entry/resize. No Kitty config changes or remote control required.
- **Tuning:** `BURN_MS`, `FLAME_ROWS` and `EFFECT_FPS` live in
  `src/renderer/typingEffects.ts`; visuals live in `src/renderer/effectPixels.ts`.
  `TYPE_BLITZ_EFFECT_FONT='Your Monospace Font'` changes the effect glyph font (default:
  system monospace; it does not automatically read Kitty's font settings).
- **Fallback:** `TYPE_BLITZ_EFFECTS=ansi npm start` uses text flames and blue ice cells.
  Browser-audio PTYs and tmux default to this path; `TYPE_BLITZ_EFFECTS=kitty` explicitly
  forces graphics where supported. Use at least 20 terminal rows for the full Kitty view.

After changing source, run `npm run build` to update the `type-blitz` executable's build.
Run `npm test` for engine, layout, effect lifecycle/pixels/protocol, score and audio tests.

---

## 🎮 Game Controls

| Key | Action |
| --- | --- |
| **Typing Keys** | Type characters matching the passage stream |
| **Backspace** | Erase previous character / clear error state |
| **UP / DOWN** | Navigate menu options & passage list |
| **ENTER / SPACE** | Select menu option or start quick play |
| **ESC** | Pause / Return to Main Menu |
| **CTRL + R** | Restart current passage test |
| **Q / CTRL + C** | Exit game |

---

## Browser terminal integration

The game remains a normal native terminal application. The companion browser host at
`/home/poop/code/dev/type-blitz-terminal-web` launches the built CLI in a PTY and uses:

- `TYPE_BLITZ_SCORES_FILE` to keep browser-session scores separate from personal scores.
- `TYPE_BLITZ_SOUND_DIR` to place generated WAV assets in the browser runtime directory.
- `TYPE_BLITZ_AUDIO_FD` (an inherited descriptor) for newline-delimited generic audio commands.

Without `TYPE_BLITZ_AUDIO_FD`, audio plays locally as before. Local playback now owns and
stops only the children it launches; it never uses broad process-name matching.

## 📦 Machine Layout Contract (`AGENTS.md`)

- **Source Code**: `/home/poop/code/dev/type-blitz`
- **CLI Executable Symlink**: `/home/poop/.local/bin/type-blitz`
- **High Scores Configuration**: `/home/poop/.config/type-blitz/highscores.json`
- **Engine Verification Tests**: `npx tsx src/__tests__/engine.test.ts`
