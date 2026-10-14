# Current Goal
Keep the accepted fire/ember/crumble visuals unchanged. Prevent backspacing into correctly typed letters; play the wrong-key sound at that boundary.

# Current State
Engine `handleBackspace()` returns erased/blocked/ignored. Only the error suffix is erasable; correct characters (including spaces) lock immediately, regardless of burn phase. Main game plays existing `playBeep` on blocked attempts, respecting mute; counters/streak/input and effect history are untouched. Empty/completed input is ignored. Demo follows the rule but remains silent. Build/full tests pass, including phase-by-phase no-resurrection tests. Actual CLI input/audio integration verified correction, error erasure, blocked boundary and muted behavior.

# Decisions
Use one reusable Kitty RGBA image, 30 FPS renderer with sprite poses stepping every 90 ms, three reserved rows above the stream. Separate `FLAME_MS`, `EMBER_MS`, `CRUMBLE_MS` sum to `BURN_MS`; phase timing follows effective progress so edge acceleration remains coherent. Rasterize/erode glyph masks via `@napi-rs/canvas`; keep upcoming text native. Fire paints first, ice next, glyphs last so adjacent effects cannot cover letters. Transmit-and-place remains necessary: root animation-frame edits left stale textures in tested Kitty. Browser-audio PTYs/tmux default to text fallback. No machine/Kitty config changes.

# Open Problems
User is happy with the current visuals/timing and wants to keep them. No known backspace blocker remains; await any play feedback. Do not alter the effects or revert to realistic shading. Effect font defaults to system monospace, not automatically Kitty's font; env override is documented. Tiny windows use the text fallback. Unrelated untracked `notes.md` appeared during this session and must be preserved.

# Resume Instructions
From this repo, run `npm run effects:demo` inside Kitty. Type to take over, Ctrl+R to replay, Esc to exit. Tune `typingEffects.ts` timing and `effectPixels.ts` visuals. Run `npm run build && npm test` after edits; `type-blitz` uses `dist`. Disposable screenshots/protocol debugging are under `/home/poop/tmp/type-blitz-effects/`, not source assets. No background test processes intentionally left running.
