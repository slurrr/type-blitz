# Current Goal
Restore the user's design: Daily is the same random Quick Play game with a generated passage pool. All accepted voices every day; no voice rotation, sequential deck or mode-specific decorative UI. Implemented; await user trial.

# Current State
Both Quick Play modes call the existing `getRandomPassage(pool)` (Math.random, uniform per passage, repeats allowed). Shared countdown, renderer, Next/Retry and initials → high-score screen. Removed DailyDeck, DAILY_WAIT screen/state, model/date/count menu rows, DAILY n/8 banner prefix and gameplay date/progress footer. Original header/footer restored. Only selecting Daily without an available pool produces a loading/unavailable notice in the existing menu footer.

Daily generation now makes 16 passages: all three forecasters for BOTH today and extended (six), both weather reactions (two), accepted headline reaction for each story (two), all three original buzz voices for EACH topic (six). No date-based subset or play-order/category balancing. Accepted prompt files unchanged. Sol 6.1 low, cached by Helena launch-day, manual R / --daily-refresh, background worker, immutable history and failure retention remain. No engine/effects/scoring changes.

New packs use version 2 (16 entries). Original eight-entry version-1 packs stay readable for history/fallback, not rewritten or deleted. Runtime `/home/poop/runs/type-blitz/daily/` remains separate from preview experiments. Details: root README, src/daily/README.md, runtime daily/README.md.

# Decisions
User explicitly rejected the invented voice schedule, ordered play-through and additional renderings. Do not reintroduce them or add a shuffle bag/no-repeat policy. Use every accepted voice for each relevant input so polarity is represented. Do not change the accepted prompts or turn headline opinions into factual recaps. Preview defaults/history stay separate; no web host changes.

# Verification
Build/full tests pass: all voices on every input and across dates, 16-call concurrency, all random indices/repeats reachable through the same classic picker, cached reuse/failures/history, legacy pack readability, and PTY checks for normal initials → scores, random Next staying in Daily, Retry preserving text, no extra model/date/count decorations, HJKL/classic/custom isolation. LSP clean.

One explicit live refresh succeeded: 16 ready passages, runtime attempts 009–024, no format warnings. Pack UUID 43e02702-1ac6-4d39-a56a-517d99e4eced; local day 2026-10-14; generated 2026-10-15T02:11:24.732Z. Audited every voice count, Sol 6.1 low, no tools, verified payloads. Cached startup makes no new calls. Installed type-blitz tested in a 24x120 PTY: normal menu/header/footer, daily play/back/quit, no decorations or extra calls. No background processes intentionally left running.

# Open Problems
Await user feedback. Browser/source availability can prevent generation; retain the prior pack. Day/error/model details are inspectable with --daily-status, not displayed in the game. Hard-killed writers may leave .lock; inspect PID and remove only a confirmed stale lock before explicit refresh. Existing browser transport is workstation-local, not public hosting.

# Resume Instructions
Today's corrected 16-passage pool is ready: launch type-blitz normally. Do not run another live refresh without a reason/request. Read-only: type-blitz --daily-status. Runtime override: --daily-dir / TYPE_BLITZ_DAILY_GAME_DIR. Inspect game attempts via `npm run daily:preview -- --dir ~/runs/type-blitz/daily list` / `show ID --prompt`. Preserve all preview and game history. No new gameplay abstractions or UI decoration.
