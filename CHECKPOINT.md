# Current Goal
User accepted headline synthesis/voice (067/068 good). Prompts locked in for now. Daily mode is implemented and ready for the user's terminal trial; await feel/quality feedback rather than further prompt tuning.

# Current State
First menu entry QUICK PLAY (DAILY GEN AI); classic moved to second. Sol 6.1 low for all daily writing. Eight interleaved passages: today/extended Helena forecasts (two of three accepted presenters rotate daily), positive/negative weather reactions, two headlines, two distinct Reddit buzz topics (accepted original voices rotate). Accepted prompt files unchanged. Daily next/restart stays in its pack; saving initials advances; classic/custom/scoring/effects retained.

Automatic generation runs in a child at startup, one attempt per America/Denver launch-day (including failures), with progress in the responsive menu. Same-day cache reuse makes no calls. R at menu/waiting screen or `type-blitz --daily-refresh` explicitly recollects/regenerates; repeated R coalesces. `--daily-status` is read-only; `--no-daily` skips auto work but allows cached play; `--no-sound` starts silently. Shared lock prevents duplicate calls; complete packs published atomically; failure retains dated prior pack. Quitting aborts calls/further collection and allows owned-tab cleanup.

New modules: src/daily/{session,sources,client,worker}.ts, renderer/dailyView.ts. One shared Reddit feed, <=6 article navigations, four bounded discussions (two headlines + two other topics), two NWS requests. No semantic news classifier or subreddit allowlist. Game runtime is `/home/poop/runs/type-blitz/daily/`, separate from previews; README there owns files/recovery. Immutable packs, sources and numbered exact attempts retained.

# Decisions
Preview 067/068 marked good from explicit user acceptance; comparison updated. Do NOT reintroduce factual-reporting constraints into headline reactions. Original Reddit preview defaults remain Luna/xhigh for historical experiments; playable mode explicitly uses Sol 6.1 low for every role. Weather sources are fresh NWS, not copied experimental anecdotes. No host/web companion changes; browser transport remains workstation-local.

# Verification
Build/full tests pass, including offline shared-feed collection, cache/rollover/DST, forced refresh, history immutability, failed/partial/cancelled first/subsequent runs, concurrent locks, corrupt state, worker IPC/eval flags, source isolation and PTY next/retry/scores/HJKL/classic/custom.

One live full pack succeeded: local day 2026-10-14, generated 2026-10-15T01:29:55.200Z, UUID fdee671b-659e-4862-b6a2-667cad25efc8. Daily-runtime attempts 001–008 all ready, Sol 6.1 low, isolated payloads, no format warnings; longest call 8.559s. New outputs unrated. Accepted headline prompt hash df6ebf4cc7d3 verified. Cached child check ~36ms, zero new attempts/cache changes. Installed `type-blitz` tested in a 24x100 PTY with normal automatic startup: cached pack, daily countdown/stream/back/quit, zero new generation, no lock left. No background processes intentionally left running.

# Open Problems
Await hands-on trial. Article availability, limited feed eligibility and source readability can prevent a complete pack; failures are visible and preserve old content. A hard-killed writer can leave .lock: inspect PID, remove only confirmed stale lock, explicitly refresh. No automatic lock guessing or silent retries. No public hosting architecture.

# Resume Instructions
Use `type-blitz` now; today's pack already ready. Read root README and src/daily/README.md. `type-blitz --daily-status` is read-only. Do not spend another live refresh or change accepted prompts without a reason/user request. Runtime override: --daily-dir / TYPE_BLITZ_DAILY_GAME_DIR, independent of preview TYPE_BLITZ_DAILY_DIR. Inspect game attempts using `npm run daily:preview -- --dir ~/runs/type-blitz/daily list` / `show ID --prompt`. Keep preview experiments/history intact.
