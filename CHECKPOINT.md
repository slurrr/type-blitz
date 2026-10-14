# Current Goal
Add hjkl navigation while preserving literal text input and all accepted gameplay/effect behavior.

# Current State
`src/navigation.ts` maps unmodified lowercase aliases before screen dispatch. Menu: j/k move, l selects. Passage list: j/k move, l starts, h backs out. High scores: j/k scroll, h backs out (l has no forward destination). Summary: l continues, h returns to menu. Root h is a no-op. Gameplay, custom text and initials retain literal hjkl; modified keys and existing bindings remain unchanged. Help/README updated. Build/full tests and real CLI navigation/text-entry integration pass.

# Decisions
Use one reusable Kitty RGBA image, 30 FPS renderer with sprite poses stepping every 90 ms, three reserved rows above the stream. Separate `FLAME_MS`, `EMBER_MS`, `CRUMBLE_MS` sum to `BURN_MS`; phase timing follows effective progress so edge acceleration remains coherent. Rasterize/erode glyph masks via `@napi-rs/canvas`; keep upcoming text native. Fire paints first, ice next, glyphs last so adjacent effects cannot cover letters. Transmit-and-place remains necessary: root animation-frame edits left stale textures in tested Kitty. Browser-audio PTYs/tmux default to text fallback. Correct letters remain irreversible from ignition; backspace only clears errors and otherwise plays the existing error sound without score penalties. No machine/Kitty config changes.

# Open Problems
User is happy with the current visuals/timing and wants to keep them. No known navigation/backspace blocker remains; await play feedback. Do not alter the effects or revert to realistic shading. Effect font defaults to system monospace, not automatically Kitty's font; env override is documented. Tiny windows use the text fallback. Unrelated untracked `notes.md` appeared during this session and must be preserved.

# Resume Instructions
Run `type-blitz` in Kitty to try navigation. Key aliases are in `src/navigation.ts`, dispatched in `src/index.ts`; tests are in `src/__tests__/navigation.test.ts`. Keep hjkl literal in text-entry states. Run `npm run build && npm test` after edits; `type-blitz` uses `dist`. `npm run effects:demo` is the silent effects sandbox. Disposable screenshots/protocol debugging are under `/home/poop/tmp/type-blitz-effects/`, not source assets. No background test processes intentionally left running.
