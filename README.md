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
4. **Orange Highlighter & Red Error Cascade**:
   - Correctly typed characters light up in **vibrant neon orange highlighter**.
   - If you hit a wrong key, the typo letter **turns RED**, and **all subsequent keystrokes turn red** until you press `Backspace` to clear past the mistake!
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

## 📦 Machine Layout Contract (`AGENTS.md`)

- **Source Code**: `/home/poop/code/dev/type-blitz`
- **CLI Executable Symlink**: `/home/poop/.local/bin/type-blitz`
- **High Scores Configuration**: `/home/poop/.config/type-blitz/highscores.json`
- **Engine Verification Tests**: `npx tsx src/__tests__/engine.test.ts`
