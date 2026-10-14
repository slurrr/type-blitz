# Current Goal
Choose a daily-passage model by writing quality and wall time, not price. User prefers Astra over Luna across voices, low effort sufficient/possibly better, xhigh too slow. Compare Sol 5.6 off/xhigh and Sol 6.1 low/xhigh using the same frozen source and exact three archived voice prompts.

# Current State
Completed full Sol matrix. Immutable attempts 013–024 were twelve concurrent requests; 016 (6.1/xhigh student) hit server overload. Retained failure and explicitly retried only that cell alone as 025, successfully. All Sol results remain unrated. Derived full reading/timing view: `/home/poop/runs/type-blitz/daily-preview/sol-comparison.md`; authoritative attempts and reviews alongside it. Verified exact archived requests, physical models and outgoing reasoning efforts. Astra 009–012 marked good with user's nuanced quality/latency notes. CLI now supports repeatable `--variant model:thinking` for mixed-model comparisons, preserving old `--model/--thinking` shorthand. Build/tests pass; no game/default/prompt changes.

# Decisions
Isolated Pi ModelRuntime; no coding prompt/tools/history/resources, automatic retries or rewrites. Frozen source a19509fbbf7b; replay 001/student, 002/blogger, 003/satirist. Every outcome retained with separate human good/mid/bad ratings; unrated means unreviewed. User found Astra blogger xhigh maybe marginally better but uncertain; satirist low better. Low preferred overall. Defaults still Luna 5.6/xhigh until explicit decision; no game integration yet.

# Open Problems
Await Sol quality judgments/model choice. Per-call seconds, student/blogger/satirist: Sol 5.6 off 3.144/3.157/4.397; 5.6 xhigh 6.458/7.090/6.987; 6.1 low 4.734/5.950/5.340; 6.1 xhigh 48.622 (solo retry)/17.989/28.554. Initial mixed batch 28.61 s (29.11 with prep); retry 48.64 s (49.15 with prep). Single samples under mixed concurrency, not a benchmark or isolated three-call batch measurements. Browser transport remains workstation-local, not server-ready. No background processes intentionally left running.

# Resume Instructions
Read `src/daily/README.md` and the Sol reading view. `npm run daily:preview -- list --by-prompt`, `show 025 --prompt`, `mark 013 good|mid|bad --note "..."`. Do not generate again without request; no Reddit refresh for model/prompt tuning. Full mixed matrix command in README creates TWELVE NEW calls, not a read-only report. Earlier Luna 001/student and 003/satire good, 002/blogger mid; 004–006/off good. Astra 007–012 good; low per-call 5.147/5.860/5.773 s, xhigh 32.743/12.990/34.992 s. Future first game option exactly `QUICK PLAY (DAILY GEN AI)`: Helena today/extended weather, two news and two buzz stories, parallel launch-day generation. Accepted effects/sound/navigation unchanged.
