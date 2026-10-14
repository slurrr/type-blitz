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
   - In Kitty, chunky arcade flame sprites and square embers rise above the text—flat neon colors, no realistic glow.
   - Mistakes become cracked blue ice blocks. `Backspace` clears the error cascade, but correctly typed letters are irreversible once ignited. Trying to erase one plays the wrong-key sound.
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

- **Burn:** ~1.6 seconds of flames, a 0.36-second ember-letter hold, then a slower
  1.4-second crumble (~3.36 seconds total). The tail flickers orange/red, sheds pixel
  chunks, and cools to dark embers. Edge acceleration still finishes it before scrolling out.
- **Style:** hand-pixelled flame cels, a six-color fire palette, square sparks and hard edges.
  Sprite poses step every 90 ms while the renderer updates at 30 FPS. Flames shrink in
  stages and letters break away in pixel chunks instead of dissolving into a smooth glow.
- **Ice:** flat blue arcade tiles with chunky bevels, stepped cracks and a brief square-pixel
  frost burst. They persist until erased.
- **Layout:** flames stay behind the cursor; upcoming text remains native terminal text.
  Burned characters keep their space. Backspace only erases frozen mistakes; it cannot
  restore correct letters during flames, embers, crumble, or after they disappear.
  Blocked backspaces use the wrong-key sound (when sound is enabled), without changing
  score counters, accuracy or streak. Restart explicitly restores the passage.
- **Implementation:** `@napi-rs/canvas` rasterizes glyph masks; the renderer erodes those
  masks and draws hard-edged flame sprites/ice tiles. Compressed RGBA goes directly through the
  [Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/), with one
  reusable image ID and no per-frame files or subprocesses. `kitten icat --print-window-size`
  measures cell pixels on entry/resize. No Kitty config changes or remote control required.
- **Tuning:** `FLAME_MS`, `EMBER_MS`, `CRUMBLE_MS` (which sum to `BURN_MS`),
  `FLAME_ROWS` and `EFFECT_FPS` live in `src/renderer/typingEffects.ts`;
  visuals live in `src/renderer/effectPixels.ts`.
  `TYPE_BLITZ_EFFECT_FONT='Your Monospace Font'` changes the effect glyph font (default:
  system monospace; it does not automatically read Kitty's font settings).
- **Fallback:** `TYPE_BLITZ_EFFECTS=ansi npm start` uses text flames and blue ice cells.
  Browser-audio PTYs and tmux default to this path; `TYPE_BLITZ_EFFECTS=kitty` explicitly
  forces graphics where supported. Use at least 20 terminal rows for the full Kitty view.

After changing source, run `npm run build` to update the `type-blitz` executable's build.
Run `npm test` for engine, navigation, layout, effect lifecycle/pixels/protocol, score,
audio and standalone daily-preview tests.

---

## 🎮 Game Controls

| Key | Action |
| --- | --- |
| **Typing Keys** | Type characters matching the passage stream |
| **Backspace** | Erase frozen mistakes only; stops at the last correct letter |
| **J / K** or **DOWN / UP** | Move down/up in menus, passage list and high scores |
| **L** or **ENTER / SPACE** | Select/open a menu item, start a passage, or continue from results |
| **H** | Back to the menu from passage selection, high scores or results |
| **ESC** | Pause / Return to Main Menu |
| **CTRL + R** | Restart current passage test |
| **Q / CTRL + C** | Exit game |

`hjkl` navigation applies only on navigation screens. During gameplay, custom passage
input and initials entry, all four letters remain ordinary text. Existing arrow keys,
Enter/Space, Escape, Page Up/Down and other shortcuts still work. `h` does nothing at
the main menu; `l` does nothing on high scores, where there is no forward destination.

---

## Daily passage voice experiment

A standalone writing preview—no game/menu changes yet. Freeze one Reddit discussion,
then compare three independent voices using Pi's existing OpenAI/Codex login.
Defaults to **Luna 5.6 / xhigh**. Model calls have no coding-agent prompt or tools.

```bash
npm run daily:preview -- collect       # Reuses saved input; no repeated scraping
npm run daily:preview -- generate      # Three sequential calls, new immutable IDs
npm run daily:preview -- list          # All attempts, including bad/failed results
npm run daily:preview -- show 001 --prompt  # Exact historical passage and prompt
npm run daily:preview -- mark 001 good # Quality: good / mid / bad
npm run daily:preview -- list --by-prompt # Quality counts by prompt/model/thinking
npm run daily:preview -- generate --from 001 --thinking off  # Exact-input comparison
```

Edit `prompts/daily/{student,blogger,satirist}.md` to change voices. Numbered, immutable
attempts and separate quality ratings live in `~/runs/type-blitz/daily-preview/`, not
Git. No replacement/deletion of earlier attempts. See [the prototype guide](src/daily/README.md)
for model/thinking options, extraction limits, isolation, and the future daily mode.

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
