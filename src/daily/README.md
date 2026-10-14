# Daily passage voice experiment

Standalone; nothing here is imported by the game. First prove the writing, then
integrate it. No daily scheduler/cache policy, weather collector or new menu yet.

## Try it

Requires `bb-browser` with an accessible browser and a globally installed
`@earendil-works/pi-coding-agent` with an OpenAI/Codex login. No new credentials
are required on this workstation. The prototype does not alter browser/account setup.

From the repository root:

```sh
# Fetch once, then reuse this packet without more browser access.
npm run daily:preview -- collect

# Inspect current input/latest results, or the complete history table.
npm run daily:preview -- show
npm run daily:preview -- list
npm run daily:preview -- list --by-prompt  # Quality counts, including bad results

# First batch: one independent call at a time, each with a new permanent ID.
npm run daily:preview -- generate

# Inspect an exact historical passage, instructions, and (optionally) source input.
npm run daily:preview -- show 001 --prompt
npm run daily:preview -- show 001 --input
npm run daily:preview -- show 001 --json

# Human review, separate from immutable generation records.
npm run daily:preview -- mark 001 good --note "This voice works."
npm run daily:preview -- mark 002 mid --note "Worth revisiting."
npm run daily:preview -- mark 003 bad --note "Why it missed."
npm run daily:preview -- review                # Good only
npm run daily:preview -- review --include-mid  # Good first, then mid; never bad

# Edit prompts/daily/student.md and generate a NEW attempt using that edit.
npm run daily:preview -- generate student

# Controlled comparison: EXACT archived instructions AND input, no current files.
npm run daily:preview -- generate --from 001,002,003 --thinking off
npm run daily:preview -- generate --from 001 --model gpt-5.6-luna --thinking high

# Explicit concurrent low-vs-xhigh comparison, one voice and the SAME archived input.
npm run daily:preview -- compare 001 --model gpt-6-astra --thinking low,xhigh
# Full three-voice matrix: 3 archived prompts x 2 efforts = 6 concurrent calls.
npm run daily:preview -- compare 001,002,003 --model gpt-6-astra --thinking low,xhigh

# Mixed-model matrix: 3 voices x 4 model/effort variants = 12 concurrent calls.
npm run daily:preview -- compare 001,002,003 \
  --variant gpt-5.6-sol:off --variant gpt-5.6-sol:xhigh \
  --variant gpt-6.1-sol:low --variant gpt-6.1-sol:xhigh

# Only when you actually want a new topic:
npm run daily:preview -- collect --refresh
```

The numbered examples above illustrate commands; use `list` to choose your actual IDs.
Existing baseline 001/student and 003/satirist are marked good from user feedback.
002/blogger is marked mid from the user's “fine” assessment, retaining their note
about audience versus personal preference. These are quality judgments, not favorites.
The user also rated Luna/no-thinking results 004–006 good, judging them as good as
xhigh for this quick generation task. New results start unreviewed (shown as unrated);
that is not a fourth quality tier.

### Model and timing

Defaults: **openai-codex/gpt-5.6-luna, xhigh**. `--thinking` accepts off, low,
medium, high, xhigh. Off is verified as `reasoning.effort: none` in the actual outgoing
payload, not silently mapped to low. Unsupported effort/model requests fail; there
is no fallback or automatic retry. Each call times out after five minutes.

The normal `generate` command is **sequential** for easier per-call timing comparisons.
`compare IDS --model MODEL --thinking low,xhigh` is explicitly **concurrent**: one call
per archived prompt x requested effort, with the exact saved instructions/source for
each voice. For multiple models, repeat `--variant model:effort` instead of
`--model`/`--thinking`; each voice runs once per variant. Mixing both forms or repeating
a variant is rejected before calls. Pass comma-separated IDs; duplicates are also rejected. To
fill an incomplete comparison, specify only the missing voices. IDs are reserved
serially before calls start, and all calls/writes settle before releasing the lock.
One failed model response does not discard the other result. Execution mode is recorded.
Output reports individual request duration, batch wall time, and wall time
including preparation. Per-attempt durations and execution mode are archived. Batch
wall time is printed, not a separate persisted experiment record. Later game generation
should be parallel for low wall-clock latency; the game is not integrated here.

Token counts describe subscription usage, not a dollar invoice; output counts may
include reasoning. Single runs are observations, not controlled performance benchmarks.

## Immutable history and marks

Default directory: `~/runs/type-blitz/daily-preview/`. Override with `--dir <path>`
before the subcommand or `TYPE_BLITZ_DAILY_DIR`. Keep runtime data outside source.

- `context.json`: current frozen topic. Refresh can replace this, but not archived inputs.
- `attempts/001-student.json`, etc.: permanent numbered records. Includes exact prompts
  and input, generated/raw text, model/effort, time, token usage, source/prompt SHA256s,
  normalized ordinary `Passage`, and isolation audit. `replayOf` connects a comparison
  to its original. Prompt hash covers system/voice instructions; source hash covers
  the frozen packet. Same hashes let you recognize unchanged experimental inputs.
- `reviews.json`: editable **good / mid / bad** marks, notes and review timestamps.
  `mark ID unrated` clears a mark. Omitting `--note` preserves an existing note;
  explicitly passing an empty note clears it. Reviews never alter attempt files.
- `.lock`: contains the active writer/collector/reviewer PID. If interrupted, check
  that PID before manually removing a stale lock. No worker/scheduler owns it.

`list` includes everything: good/mid/bad/unrated, errors and interrupted requests.
`review` includes only ready passages marked good; `--include-mid` adds mid after good.
Bad, unrated and failed records never enter the reading selection, but remain available
through `list` and explicit `show ID`. `list --by-prompt` counts good/mid/bad and
unreviewed results for each exact prompt + model + thinking setting, and includes
all attempt IDs. Bad results are evidence for improving prompts, never discarded.
The counts describe human quality judgments; there is no automated score or ranking.

There is **no replace/delete command**. Every explicit generation appends an attempt.
Final JSON is published atomically and exclusively, then remains read-only; the
application never rewrites it. A `.pending.json` holds the exact request during a call.
On completion it is superseded by a separate immutable final record and removed.
If interrupted, pending stays visible, its ID stays consumed, and no retry runs
silently. After a refresh, `show` without an ID displays only the latest attempts
matching the current source; numbered `show` and review work across all sources.

Git tracks the code and editable prompt files. Runtime history tracks what was
actually sent and returned, independent of whether the prompt changes were committed.
Keep/back up the runtime directory if these experiments matter; read-only files are
not a substitute for a backup and the owner can still manually remove them.

### Import the original prototype results

```sh
npm run daily:preview -- migrate --execution parallel
```

This imports the original `student.json`, `blogger.json`, and `satirist.json` without
changing a byte of them. Exact file hashes make repeated migration idempotent. Source
metadata comes from their saved input, not the current context. Execution defaults
to unknown; the initial batch in this project was known to be parallel. The preserved
legacy files are never written again by the new CLI. No credentials are archived.

## Boundaries

- `reddit.ts`: pure eligibility/cleanup functions. Source claims stay separate from
  comment branches, replies and votes.
- `browser.ts`: one feed navigation (first 25 popular/hot posts), then one bounded
  comments request. No recursive `more` downloads, HTTP retries, reloads or LLM
  browsing agent. The owned tab is targeted by ID and closed; other tabs are untouched.
- `pi.ts`: replaceable `Writer.generate({ systemPrompt, userPrompt })` transport.
  Uses **Pi's ModelRuntime directly**, not AgentSession/CLI. No coding prompt, tools,
  history, resource discovery, skills, extensions, settings, templates, appended
  instructions or model overrides. Existing credentials remain inside Pi.
- `preview.ts`: frozen input, current editable prompts, prose validation/display.
- `history.ts`: immutable attempts, migration, exact replay, sequential generation,
  explicit parallel comparisons, and reviews.
- `variants.ts`: validates single-model or mixed-model comparison settings before calls.
- `../dailyPreview.ts`: small CLI composition. Generation never invokes the collector.
- `../../prompts/daily/`: shared format/source guidance plus independent voice files.
  A request contains shared + only its voice. No other voice's instructions/results.

Pi loads from the global npm package directory so the game has no coding-agent
package dependency. For a different installation, `TYPE_BLITZ_PI_ROOT` can point to
its package root containing `package.json` and `dist/index.js`. A normal API transport
can later replace `pi.ts` independently of prompts, history, extraction and the game.

`onPayload` checks the actual provider payload before sending: exact instructions,
exact single user input, requested effort, no tools or response storage. Unexpected
injection or effort downgrades fail closed. No hidden reasoning, credentials, headers
or agent sessions are written to artifacts. Raw generated prose is kept without an
LLM rewrite. Typography is normalized for typing; malformed output is visibly flagged,
and word counts outside 45–60 produce a warning without discarding the prose.

## Extraction limits and account care

Eligibility is mechanical, not a semantic classifier: recent (72-hour) post, 20+
comments, descriptive text. Cleanup removes deleted/moderator/bot material, duplicate
comments and image-only replies. Keep up to six substantive top-level comments and two
replies each with parent links. Media posts require substantial post text. No article
or media interpretation is attempted. A fresh post may describe an older event.
Inspect the packet before writing; thread claims are not independently verified.

The public `r/popular/hot` feed is used, not the account's home feed/subscriptions,
but account/session/region effects are not ruled out. Top votes aren't universal
consensus. Freeze once and iterate on saved material to minimize account traffic.

Browser navigation readiness is checked through bounded local DOM reads (no HTTP
retry). Large CLI output uses a temporary regular file, deleted after parsing,
because bb-browser can truncate piped stdout when exiting. Blocks/login pages stop
collection. This browser transport is a local prototype, not server-ready access.

## Tests and eventual game mode

`npm run build && npm test` covers extraction, tab ownership/readiness/cleanup, input
reuse, prompt isolation, exact reasoning selection (including off), sequential calls,
immutable publication, migration, review filters, exact replay, same-voice concurrent
ID reservation/failure isolation, and interruption/failure
retention. Fixtures/fake transports only: tests never call Reddit or an LLM.

The eventual first menu entry is exactly `QUICK PLAY (DAILY GEN AI)`: Helena today +
extended weather, two news stories and two buzz topics, with varied voices. Weather
starts with the location and accurately delivers the forecast. One collection refresh
on launch-days, not necessarily one model call; no unattended daily scheduler.
Keep classic gameplay responsive and generate in parallel for the game. None of
that integration is implemented yet.
