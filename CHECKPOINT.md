# Current Goal
Match the TUI's 80s arcade aesthetic: the user liked the fire functionality but rejected realistic, smooth flames as cheesy. Await feedback on the pixel-art revision.

# Current State
Normal game and silent `npm run effects:demo` now use hand-pixelled flame cels, six flat fire colors, square embers, staged shrinking and hard-edged glyph erosion. Ice uses flat arcade tiles, chunky bevels and stepped cracks. No gradients, soft alpha or realistic fluid fire. Build/full tests pass, including palette, hard-alpha, square-block, sprite cadence and ice-overlap checks. Revised fire/ice were visually checked in real Kitty under isolated Xvfb. Earlier lifecycle checks covered backspace, resize, restart, menu and quit.

# Decisions
Use one reusable Kitty RGBA image, 30 FPS renderer with sprite poses stepping every 90 ms, three reserved rows above the stream, ~1.6-second burns with edge acceleration. Rasterize/erode glyph masks via `@napi-rs/canvas`; keep upcoming text native. Fire paints first, ice next, glyphs last so adjacent effects cannot cover letters. Transmit-and-place remains necessary: root animation-frame edits left stale textures in tested Kitty. Browser-audio PTYs/tmux default to text fallback. No machine/Kitty config changes.

# Open Problems
Await aesthetic feedback on the pixel-art revision; do not revert to realistic flame shading. Effect font defaults to system monospace, not automatically Kitty's font; env override is documented. Tiny windows use the text fallback. Unrelated untracked `notes.md` appeared during this session and must be preserved.

# Resume Instructions
From this repo, run `npm run effects:demo` inside Kitty. Type to take over, Ctrl+R to replay, Esc to exit. Tune `typingEffects.ts` timing and `effectPixels.ts` visuals. Run `npm run build && npm test` after edits; `type-blitz` uses `dist`. Disposable screenshots/protocol debugging are under `/home/poop/tmp/type-blitz-effects/`, not source assets. No background test processes intentionally left running.
