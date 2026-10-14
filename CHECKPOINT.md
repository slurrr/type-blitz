# Current Goal
Review the first weather voice batch. User chose Sol 6.1 low, Astra 6 low and Luna 5.6 off, with all original/weather voices plus a dark weatherman mirroring the warm friend. We ran relatable-commentary (`feel`) mode only; no separate today/extended batches yet.

# Current State
18 successful concurrent weather attempts 026–043, all unrated, no failures/retries. Reading view: `/home/poop/runs/type-blitz/daily-preview/weather-comparison.md`, grouped by voice with all passages/timings. Batch 8.60 s / 9.09 s including preparation. Per-call ranges: Sol 4.588–8.506 s, Astra 3.243–5.471 s, Luna 1.614–1.828 s. Exact input identical across all 18; each voice prompt identical across models; model/effort/payload audits verified. No weather or Reddit refresh.

Added `prompts/weather/weather-dark.md` and the sixth voice. Friend prompt unchanged; shared feel task now permits comfort OR pessimism instead of steering all voices to relief. CLI weather generation supports repeatable --variant, counts the full matrix in dry-run, rejects duplicates/mixed option forms, and supports explicit parallel or default sequential execution. Build/full tests pass. No game changes.

# Decisions
Weather source 2b0a99ed4f03 is frozen Helena NWS forecast plus separately dated user snow/melt/cold report. Predictions are not measurements. All 18 are trials awaiting human good/mid/bad ratings; basic ready status is not factual approval. Earlier Reddit model-selection doc remains `model-comparison.md` (24 successful passages + preserved failure 016; all Sol good). Separate docs cover separate experiments, not duplicate model reports. No silent defaults, retries, rewrites or source refresh.

# Open Problems
Voice separation is limited: recurring jacket advice/forecast numbers. Several outputs expose input bookkeeping ('user report') in prose. Luna 037 claims an observed afternoon high and calls the afternoon scene evening; Luna 043 may imply freezing puddles from a 33 F forecast. These concerns are noted, not assigned human ratings. Await user assessment/prompt direction. No station observations/alerts/history/road reports; headlines collector not implemented. No background processes intentionally left running.

# Resume Instructions
Read weather-comparison.md and `src/daily/README.md`. ID mapping in groups of three (Sol/Astra/Luna): student 026–028, blogger 029–031, satirist 032–034, anchor 035–037, friend 038–040, dark 041–043. `show ID --input/--prompt`, `mark ID good|mid|bad --note ...`; archived replay via generate --from / compare. `weather generate all --mode feel --parallel --variant gpt-6.1-sol:low --variant gpt-6-astra:low --variant gpt-5.6-luna:off` creates EIGHTEEN NEW attempts; add --dry-run for no calls. Do not repeat/refetch without request. Future first game mode remains QUICK PLAY (DAILY GEN AI); weather today/extended plus two news/two buzz stories. Gameplay/effects/navigation untouched.
