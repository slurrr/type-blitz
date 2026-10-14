# Current Goal
Extend the burn's lifetime without extending the flames. User likes the pixel-art effects during play (preview less convincing), but wants an ember-letter hold and slower crumble.

# Current State
Burn now has 1.6s of existing flame sprites, 0.36s holding a recognizable flickering ember-letter, then 1.4s of staged erosion and dropping fragments (~3.36s total). Flames/sparks stop before the tail; ice is unchanged. Kitty and ANSI share the phase clock, including edge acceleration. Built/full tests pass; added phase-boundary, ember hold/flicker, no-tail-flames, slow-crumble and extended-palette tests. Kitty screenshots under isolated Xvfb confirm ember letters and later dim fragmented remnants.

# Decisions
Use one reusable Kitty RGBA image, 30 FPS renderer with sprite poses stepping every 90 ms, three reserved rows above the stream. Separate `FLAME_MS`, `EMBER_MS`, `CRUMBLE_MS` sum to `BURN_MS`; phase timing follows effective progress so edge acceleration remains coherent. Rasterize/erode glyph masks via `@napi-rs/canvas`; keep upcoming text native. Fire paints first, ice next, glyphs last so adjacent effects cannot cover letters. Transmit-and-place remains necessary: root animation-frame edits left stale textures in tested Kitty. Browser-audio PTYs/tmux default to text fallback. No machine/Kitty config changes.

# Open Problems
Await play-feel feedback on the longer ember/crumble tail. Keep the pixel-art style and existing flame design; do not revert to realistic shading. Effect font defaults to system monospace, not automatically Kitty's font; env override is documented. Tiny windows use the text fallback. Unrelated untracked `notes.md` appeared during this session and must be preserved.

# Resume Instructions
From this repo, run `npm run effects:demo` inside Kitty. Type to take over, Ctrl+R to replay, Esc to exit. Tune `typingEffects.ts` timing and `effectPixels.ts` visuals. Run `npm run build && npm test` after edits; `type-blitz` uses `dist`. Disposable screenshots/protocol debugging are under `/home/poop/tmp/type-blitz-effects/`, not source assets. No background test processes intentionally left running.
