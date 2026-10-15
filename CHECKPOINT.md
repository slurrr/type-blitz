# Current Goal
User accepts the current Daily prototype as good for now and is done for the day. Leave implementation, prompts, 16-passage pool and random gameplay unchanged. Future source/quality improvements are deferred, not instructions to implement immediately.

# Current State
Both Quick Play modes call the existing `getRandomPassage(pool)` (Math.random, uniform per passage, repeats allowed). Shared countdown, renderer, Next/Retry and initials → high-score screen. Removed DailyDeck, DAILY_WAIT screen/state, model/date/count menu rows, DAILY n/8 banner prefix and gameplay date/progress footer. Original header/footer restored. Only selecting Daily without an available pool produces a loading/unavailable notice in the existing menu footer.

Daily generation now makes 16 passages: all three forecasters for BOTH today and extended (six), both weather reactions (two), accepted headline reaction for each story (two), all three original buzz voices for EACH topic (six). No date-based subset or play-order/category balancing. Accepted prompt files unchanged. Sol 6.1 low, cached by Helena launch-day, manual R / --daily-refresh, background worker, immutable history and failure retention remain. No engine/effects/scoring changes.

New packs use version 2 (16 entries). Original eight-entry version-1 packs stay readable for history/fallback, not rewritten or deleted. Runtime `/home/poop/runs/type-blitz/daily/` remains separate from preview experiments. Details: root README, src/daily/README.md, runtime daily/README.md.

# Decisions
User explicitly rejected the invented voice schedule, ordered play-through and additional renderings. Do not reintroduce them or add a shuffle bag/no-repeat policy. Use every accepted voice for each relevant input so polarity is represented. Do not change the accepted prompts or turn headline opinions into factual recaps. Preview defaults/history stay separate; no web host changes.

User clarified that attention—not strict freshness—is the goal. Reddit's hot ranking and 72-hour eligibility window are accepted. Repeated topics on a later explicit/daily generation are welcome if still attracting attention: new model calls produce new wording (not guaranteed unique). Same-day cached play remains unchanged. Headlines and buzz share one discovery snapshot and both include discussion samples; only headlines additionally read the linked publisher article. Do not add cross-day topic suppression or tighten recency unasked.

# Verification
Build/full tests pass: all voices on every input and across dates, 16-call concurrency, all random indices/repeats reachable through the same classic picker, cached reuse/failures/history, legacy pack readability, and PTY checks for normal initials → scores, random Next staying in Daily, Retry preserving text, no extra model/date/count decorations, HJKL/classic/custom isolation. LSP clean.

One explicit live refresh succeeded: 16 ready passages, runtime attempts 009–024, no format warnings. Pack UUID 43e02702-1ac6-4d39-a56a-517d99e4eced; local day 2026-10-14; generated 2026-10-15T02:11:24.732Z. Audited every voice count, Sol 6.1 low, no tools, verified payloads. Cached startup makes no new calls. Installed type-blitz tested in a 24x120 PTY: normal menu/header/footer, daily play/back/quit, no decorations or extra calls. No background processes intentionally left running.

# Open Problems
Deferred source improvement: user wants image support, potentially GIFs via sampled frames, so visual posts/comments need not be excluded for lack of text. Current path is text-only. Explore a small sample first when requested; confirm provider/model image support and input handling rather than treating image URLs as visual input. No implementation authorized this turn.

Deferred content balance: weather currently occupies 8/16 entries (50% with uniform random selection). User wants a smaller weather share while still utilizing all voices/polarity. Adding more quality non-weather material is one possibility, not a decision. They still want today/daily, an extended/weekly outlook, and both human reactions represented. Exact counts/ratio and approach are unresolved; do not silently drop voices, rotate subsets, weight categories or alter the pool. Current extended forecast covers the next six periods (roughly three days), not a full week; a weekly horizon would be a separate change to discuss.

Browser/source availability can prevent generation; retain the prior pack. Day/error/model details are inspectable with --daily-status, not displayed in the game. Hard-killed writers may leave .lock; inspect PID and remove only a confirmed stale lock before explicit refresh. Existing browser transport is workstation-local, not public hosting.

# Resume Instructions
Session closed with user approval. Today's corrected 16-passage pool is ready: launch type-blitz normally. Discuss deferred image support and content balance only when the user resumes; leave the prototype as-is meanwhile. Do not run another live refresh without a reason/request. Read-only: type-blitz --daily-status. Runtime override: --daily-dir / TYPE_BLITZ_DAILY_GAME_DIR. Inspect game attempts via `npm run daily:preview -- --dir ~/runs/type-blitz/daily list` / `show ID --prompt`. Preserve all preview and game history. No new gameplay abstractions or UI decoration.
