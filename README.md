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
5. **Daily AI Quick Play**: A fresh, saved mix of Helena weather, headline reactions and Reddit buzz, written with **Sol 6.1 low**. Generated on launch once per local day, with explicit refresh and uninterrupted classic play.
6. **Classic Literature Database**:
   - Passages from *Moby-Dick*, *1984*, *Pride and Prejudice*, *The Great Gatsby*, *Frankenstein*, *Alice's Adventures in Wonderland*, *The Metamorphosis*, *Dracula*, *Dune*, *Fahrenheit 451*, and more.
   - Custom passage input mode (paste your own text).
7. **Arcade High Scores & Grading**:
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

# Collect fresh inputs and generate another daily pack, then exit
type-blitz --daily-refresh

# Inspect the saved pack without network calls
type-blitz --daily-status

# Test collection only; save diagnostics without model calls or replacing the pack
type-blitz --daily-check

# Play cached daily/classic passages without automatic generation
type-blitz --no-daily
```

---

## Daily AI mode

The first menu item is **QUICK PLAY (DAILY GEN AI)**. Every daily pool uses all voices:
- Positive, neutral and negative forecasts for **both** today and extended: six passages.
- Positive and negative human weather reactions: two passages.
- The accepted headline-reaction voice for each of two stories: two passages.
- Student, blogger and satirist for **each** of two buzz topics: six passages.

All 16 use **Sol 6.1 low**, with concurrent isolated calls. Startup checks the
**America/Denver calendar day** and prepares the pack in a child process while the
menu/classic game remains responsive. Subsequent launches reuse the saved pack;
no launch means no calls. No scheduler or silent retries.

Press **R at the main menu** or run **`type-blitz --daily-refresh`** to collect fresh
sources and generate again, even on the same day. Repeated R presses while busy do
not queue more runs. Failed refreshes preserve the previous pack; its original date
and failure details remain inspectable with `--daily-status`. A failed automatic
attempt is not retried on every launch: use R when ready to retry.

One small status sits next to the Daily menu item: green **READY** means today's
pack completed successfully; red **FAIL** means the latest operation failed, even
when an older pack remains playable. Yellow **RUN** means work is in progress;
gray **WAIT** means no current-day success is loaded. No extra panels or gameplay
metadata are added.

Both Quick Play modes use the **same random picker and gameplay flow**—only the
passage pool differs. Each start/Next draws randomly with replacement, just like
Classic: no ordered deck, category schedule, voice rotation or repeat suppression.
Retry keeps the current passage; saving initials shows high scores as usual.
No added model/date/count displays or daily banner/footer decorations. The original
header, controls, sound, fire/ice and typing renderer are shared. If Daily is selected
before a pool is available, only the existing menu footer indicates loading/unavailable.

Runtime: `~/runs/type-blitz/daily/`, separate from voice-preview experiments. Every
successful pack and every generated attempt is retained with exact prompts/inputs.
Override with `--daily-dir` or `TYPE_BLITZ_DAILY_GAME_DIR`. Read-only status is available
with `--daily-status`; `--no-daily` disables automatic work but leaves saved packs and
explicit refresh available. `--no-sound` starts silently.

Collection requires the workstation's connected **bb-browser** and existing **Pi
OpenAI/Codex login**. It uses one Reddit popular/hot feed, bounded article/discussion
reads, and public NWS forecasts—not a hosted crawler or a universal news ranking.
Daily/headline discovery now reads up to **100 posts in one snapshot**, tries at
most **10 article candidates**, and still makes at most four discussion requests.
The reader waits for stable visible reporting, not every advertising asset to load;
security challenges and paywalls are skipped, never bypassed. Dates/800-character
minimums remain strict. Title and descriptive URL-slug overlap reduce duplicate
coverage, but do not guarantee semantic topic diversity.

`--daily-check` tests this collection path without a model login/call or changes to
`current.json`, `state.json`, attempts or packs. It prints the selected topics and
an immutable `collection/<UUID>.json` diagnostic report. Generation also archives
collection reports on success or failure: candidate URLs, skips, page-state hints,
timing and actual candidate counts. `--daily-status` links the latest run's report
when available. A source-only check does **not** turn a failed daily run into READY.
See [daily module details](src/daily/README.md) and the runtime `daily/README.md` for
history and interrupted-lock recovery.

## Browse saved data in the browser

Open **[Type-Blitz review](http://poopship.tail4eec74.ts.net:19829/)** over Tailscale
(IP alternative: `http://100.81.85.68:19829/`). The user service
`type-blitz-review.service` serves the existing game and voice-preview archives.

Choose **Archive → Saved data → Record**. Passages use the exact existing HTML
request renderer, including expandable prompts/output/audit. All older attempts,
failed/pending records and voice experiments are selectable. Newer/Older links
step through the list; **Reload list / open** reads newly saved files without
restarting or exporting pages. App timestamps use **America/Denver** with the
correct daylight-saving offset, matching the daily-run date. Older UTC records
are displayed locally without rewriting their saved JSON.

Other categories expose collection reports (including failures), packs, source
packets and saved status/context/reviews. **Saved JSON** opens the original file;
**Open full view** opens the report outside the embedded pane. A malformed record
is marked unreadable without hiding other records; its raw file remains available.
Only configured archive data is served—not arbitrary filesystem paths or credentials.

This is strictly read-only: no model calls, source collection, ratings edits,
writer locks, generated HTML files or gameplay changes. Network access follows the
existing Tailscale/firewall policy; it has no separate login and must not be exposed
publicly. Host/Origin checks, escaped data and a script-disabled report frame remain
in place. See [service deployment](systemd/README.md) for lifecycle/access details.

Foreground alternative: `type-blitz review` (defaults to `0.0.0.0:19829`), with
`--host`, `--port` and explicit `--allow-host` options. Game archive selection still
uses the global `--daily-dir`; preview selection uses `TYPE_BLITZ_DAILY_DIR`.
The CLI exports below remain unchanged.

## Inspect an archived request

```bash
type-blitz request 17                 # Render game attempt 017 as a readable HTML file
type-blitz request 67 --preview       # Use the separate voice-experiment archive
type-blitz request 17 --stdout       # Emit only HTML; no file writes
# From another machine, save the view locally:
ssh <game-host> 'type-blitz request 17 --stdout' > request-017.html
```

Default output: `~/runs/type-blitz/daily/requests/017.html` (or the selected preview
archive's `requests/`). The command prints the full path. Open that file in a browser;
no server, scripts, external assets, model calls or source refreshes are involved.
Use the existing `--daily-dir` override for other game archives. Preview selection
respects `TYPE_BLITZ_DAILY_DIR`; IDs are local to each archive, not global.

The view shows the archived instructions, readable nested source material (including
comments/replies and forecast periods), generated prose, model/effort/timing, ratings
and verification metadata. Exact input, raw output and the complete saved record are
expandable. It reads **saved requests**, not today's prompt files or web pages, and
also handles failed/pending attempts. Only the explicitly requested derived view is
written/replaced; history, ratings and the playable pool are untouched.

Numbers are attempt IDs, one per model call—not daily-pack IDs. Three-digit padding
is a minimum: `999` becomes `1000`, then `1001`, with no rollover, deletion or reuse.

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

Over SSH, the **client terminal** must support Kitty graphics. No special Kitty
configuration was required for the local game. Detection uses `KITTY_WINDOW_ID` or
`TERM` containing `kitty`; the window ID usually is not forwarded by SSH. If the remote
shell also reports `TERM=xterm-256color`, automatic detection can fall back to text.
From a Kitty window, try `kitten ssh <game-host>`, outside tmux, with at least 20 rows.
`TYPE_BLITZ_EFFECTS=kitty type-blitz` overrides detection for that launch only; it does
not add graphics support to incompatible terminals. No persistent settings are changed.

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
| **R (main menu)** | Explicitly refresh daily sources and generate a new pack |
| **CTRL + R** | Restart current passage test (no generation) |
| **Q / CTRL + C** | Exit game |

`hjkl` navigation applies only on navigation screens. During gameplay, custom passage
input and initials entry, all four letters remain ordinary text. Existing arrow keys,
Enter/Space, Escape, Page Up/Down and other shortcuts still work. `h` does nothing at
the main menu; `l` does nothing on high scores, where there is no forward destination.

---

## Daily passage voice experiment

The standalone writing preview remains available alongside the playable daily mode.
Freeze one Reddit discussion, then compare three independent voices using Pi's existing OpenAI/Codex login.
Reddit defaults to **Luna 5.6 / xhigh**. Model calls have no coding-agent prompt or tools.
Weather experiments have exactly five voices: negative/neutral/positive local forecasters
and negative/positive human reactions, with separate task inputs. Weather is accepted
for now; its prompts remain unchanged. Weather generation requires explicit model/effort.
Headlines separately discover two stories, read publisher context, and generate personal
reactions using the selected **Sol 6.1 / low** defaults.

```bash
npm run daily:preview -- collect       # Reuses saved input; no repeated scraping
npm run daily:preview -- generate      # Three sequential calls, new immutable IDs
npm run daily:preview -- list          # All attempts, including bad/failed results
npm run daily:preview -- show 001 --prompt  # Exact historical passage and prompt
npm run daily:preview -- mark 001 good # Quality: good / mid / bad
npm run daily:preview -- list --by-prompt # Quality counts by prompt/model/thinking
npm run daily:preview -- generate --from 001 --thinking off  # Exact-input comparison
npm run daily:preview -- weather collect  # Freeze Helena NWS forecast; no model call
npm run daily:preview -- weather generate forecast-negative --dry-run
npm run daily:preview -- weather generate reaction-positive --dry-run
npm run daily:preview -- weather generate all --dry-run  # Five roles, no model calls
npm run daily:preview -- headlines collect  # Discovery + linked reporting; no model call
npm run daily:preview -- headlines generate --parallel --dry-run  # Two planned requests
```

Edit `prompts/daily/{student,blogger,satirist}.md` to change voices. Numbered, immutable
attempts and separate quality ratings live in `~/runs/type-blitz/daily-preview/`, not
Git. No replacement/deletion of earlier attempts. See [the prototype guide](src/daily/README.md)
for model/thinking options, weather experiments, extraction limits, isolation, and the
playable daily mode. The complete model-selection reading view is
`~/runs/type-blitz/daily-preview/model-comparison.md`.

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
