# Current Goal
Try Kitty-native fire for correct letters and ice blocks for errors; get the user's visual feedback on the first pass.

# Current State
Implemented in the normal game and a silent `npm run effects:demo` sandbox. See README's Fire & Ice section for controls, configuration and implementation. Source lives in `src/renderer/{typingEffects,effectPixels,kittyEffects}.ts`; the engine/scoring rules are unchanged. Build and full test suite pass. Real Kitty under isolated Xvfb was visually checked for fire, ice, backspace correction, resize, restart and menu/quit cleanup.

# Decisions
Use one reusable Kitty RGBA image, 30 FPS, three rows above the stream, ~1.6-second burns with edge acceleration. Rasterize/erode glyph masks via `@napi-rs/canvas`; keep upcoming text native. Frame updates use transmit-and-place: root animation-frame edits acknowledged successfully but left the displayed texture stale in the tested Kitty. Native browser-audio PTYs/tmux use text fallback unless forced. No machine/Kitty config changes.

# Open Problems
Await aesthetic feedback: flame size, timing and ice appearance. Effect font defaults to system monospace, not automatically Kitty's font; env override is documented. Tiny windows use the text fallback. Unrelated untracked `notes.md` appeared during this session and must be preserved.

# Resume Instructions
From this repo, run `npm run effects:demo` inside Kitty. Type to take over, Ctrl+R to replay, Esc to exit. Tune `typingEffects.ts` timing and `effectPixels.ts` visuals. Run `npm run build && npm test` after edits; `type-blitz` uses `dist`. Disposable screenshots/protocol debugging are under `/home/poop/tmp/type-blitz-effects/`, not source assets. No background test processes intentionally left running.
