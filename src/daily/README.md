# Daily passage voice experiment

Standalone; nothing here is imported by the game. First prove the writing, then
integrate it. Reddit voice, weather and headline previews share immutable
history, but have separate inputs and prompt instructions. No scheduler or new game menu.

The completed model-selection reading view is
`~/runs/type-blitz/daily-preview/model-comparison.md` (all models/efforts/voices,
ratings and timing caveats). It replaces the Sol-only doc; underlying evidence is retained.

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

## Weather experiments

**Accepted for now:** preserve the current prompts and their soup-mitten/descriptive
human detail. Exclamation counts are not a tuning target. No further weather changes
or generations unless explicitly requested.

Exactly five active weather voices. No student, blogger, satirist, or old weather
personality is included in new weather generation.

| Voice | Job |
|---|---|
| `forecast-negative` | Nasty, foul-mouthed **local** weatherman delivering an actual forecast |
| `forecast-neutral` | Calm, confident, reassuring **local** weatherman delivering an actual forecast |
| `forecast-positive` | Optimistic **local** weatherman with a revealing personal reason or aside, not generic hype |
| `reaction-negative` | A person complaining about dealing with the weather |
| `reaction-positive` | A person delighting in their response to the weather |

The two jobs have different prompts **and different input projections**:
- Presenters receive official forecast periods, location and as-of time. They mention
  Helena/Montana naturally, without any required opening or city/state announcement.
  No user-report scaffolding is included. Forecast values remain predictions.
  Neutral forecasts reassure through clear expectations. Positive forecasts add a
  particular preference/plan that makes the presenter oddly cheerful; neither denies risk.
- Reactions receive only a weather situation: same-local-day user-described conditions,
  or the first applicable period's short description when no current report exists.
  No location, forecast numbers, provider labels or timestamps are injected into this
  input. They should not name a place, recite a forecast, or mention reports/sources.
  First-person feelings and profanity are allowed; this is not weather advice.
  One concrete personal intention/choice and why it matters should carry the emotion,
  without prescribing activities for particular conditions. Add one telling detail of
  taste or intention, not a generic category or a decorative proper noun. Mundane
  fictional preferences/plans are allowed; invented biography or weather facts are not.

All three presenters receive identical input; both reactions receive identical input. Across models, the exact
request for each voice is identical. The full frozen packet remains separate evidence;
the archived request records exactly the projection that was sent. Earlier records
retain their old prompts/input and remain readable/replayable, not silently upgraded.

Generation requires explicit `--model` and `--thinking`, or repeatable
`--variant model:thinking`. No default model is silently chosen. Duplicate variants
and mixed option forms are rejected. `--dry-run` prints prompts and the planned
call count without credentials, model calls or numbered attempts.

```sh
npm run daily:preview -- weather collect       # Two public NWS requests; reuse thereafter
npm run daily:preview -- weather show
npm run daily:preview -- weather note "It snowed, now it is melting, and it still feels cold."

# auto (default): today's forecast for presenters, human reaction for the other two.
npm run daily:preview -- weather generate all --dry-run
npm run daily:preview -- weather generate forecast-negative --dry-run
npm run daily:preview -- weather generate reaction-positive --dry-run

# Extended forecast is only a presenter task.
npm run daily:preview -- weather generate forecast-positive --mode extended --dry-run

# One call, after choosing MODEL and EFFORT.
npm run daily:preview -- weather generate reaction-negative --model "$MODEL" --thinking "$EFFORT"

# Current prompt-iteration model: Astra 6 low only, FIVE new calls.
npm run daily:preview -- weather generate all --parallel --model gpt-6-astra --thinking low

# Optional multi-model comparison: FIFTEEN new calls, not a read-only report.
# Add --dry-run to inspect without generating.
npm run daily:preview -- weather generate all --parallel \
  --variant gpt-6.1-sol:low --variant gpt-6-astra:low --variant gpt-5.6-luna:off
```

`--mode auto` routes each voice to its own job. Explicit `today` / `extended` are
only valid for presenters; `feel` only for reactions. Incompatible combinations fail
before model setup. `all --mode feel` is intentionally invalid; it would turn the
weathermen into commentators again. Default single voice: `forecast-neutral`.
Runs are sequential unless `--parallel` is explicit.

Today selects remaining periods of the location's day, including an ongoing overnight
period; extended selects the next six periods starting after that day (normally three
days). Date boundaries use America/Denver, not the machine timezone. Forecast tasks
require applicable forecast periods. Reactions can run from a current user report alone.
The target remains one 45–60-word paragraph, not a mandatory sentence template.

`weather-context.json` is independent of Reddit's `context.json`. It retains NWS
provider/URL/issued time, units, wind, precipitation probabilities (unknown is not zero),
period boundaries and separately dated user anecdotes. Adding a note does not change
the forecast issue time. Refresh retains reports; stale-day reports are not selected
as the current reaction scene. Reports are not station observations. No alerts,
historical snowfall or road reports are collected.

Collection uses two bounded public requests, no credentials, redirects or retries.
Failure preserves prior input. Generation never collects or silently refreshes.
The model writes for the frozen as-of time, not necessarily today's real weather.
Refresh only deliberately with `weather collect --refresh`.

Results join the same immutable numbering, timings, good/mid/bad ratings and
`list/show/review`. Use `show ID --input` or `--prompt` for exact evidence.
`generate --from ID` and `compare ID ...` replay archived requests, including retired
voices whose editable files have been removed. Retired voices are not current CLI choices.
`weather-comparison.md` in the runtime directory contains the current comparison
and the earlier rejected approach, not automatic quality scores. Ready means basic
format checks passed; factuality and naturalness still need human review.

## Headline experiments

A separate `headlines-context.json` freezes **two stories**, discovered from the same
public Reddit popular/hot feed rather than handpicked publishers. The writer gets
linked publisher reporting plus a separately labeled discussion sample. Reporting
supplies the situation; comments supply arguments, feelings and connections.

One independent `headline-reaction` passage per story. **Emotional recognition, not
factual coverage, is the writing goal.** Assume the reader probably saw the headline;
use a recognizable anchor, then spend the words on a human reaction. Opinions,
inferred motives/outcomes, speculation, exaggeration, sarcasm and imagined personal
preferences are welcome. Do not require evidence or reporter disclaimers for every
inference. The user explicitly approved "cheaper diesel" as perceived consequence,
not a factuality defect. These are expressive imagined speakers, not eyewitness
accounts or quotations attributed to real people.

`prompts/headlines/` asks for a specific thought that reveals a conviction, desire,
contradiction or consequence the speaker cares about. Specificity needn't be a domestic
prop. No weather personas, compulsory joke, balanced recap, positive/negative pair,
or predetermined emotional stance. Source text remains context, never instructions.
The collection's provenance/recency checks do not impose a factual-reporting style
on the writing. No subreddit allowlist or discovery changes for this prompt iteration.

**User-selected defaults for this iteration: Sol 6.1 / low.** These defaults apply
only to the new headline command; old Reddit/weather behavior is unchanged.

```sh
# Browser collection only; reuse frozen input unless --refresh is explicit.
npm run daily:preview -- headlines collect
npm run daily:preview -- headlines show
npm run daily:preview -- headlines show --json

# Read exact planned prompts/input before spending calls.
npm run daily:preview -- headlines generate --parallel --dry-run

# TWO independent calls with the selected Sol 6.1 low defaults.
npm run daily:preview -- headlines generate --parallel

# One story only; editable prompts create a new immutable attempt.
npm run daily:preview -- headlines generate 1
npm run daily:preview -- headlines generate 2 --model gpt-6.1-sol --thinking low
```

Read/inspect the sources before generating. The normal generate command is
sequential; `--parallel` is explicit. Numbered history, reviews, exact prompt/input
inspection and archived replay work as before. Story-specific fingerprints prevent
confusing outputs from different headlines. First reading view:
`~/runs/type-blitz/daily-preview/headlines-comparison.md`.

### Collection boundaries and limitations

- One discovery navigation, first 25 posts, at most six candidate article navigations.
  Post eligibility: within 72 hours, 20+ comments, descriptive headline, external HTTPS
  article URL rather than obvious image/video/social-media links.
- Read article/main paragraphs on the linked publisher in an owned browser tab.
  Require a publication timestamp with timezone within 72 hours and at least 800
  characters of reporting; cap at 14,000 characters. Retain actual final URL, title,
  published/captured times, extraction container and truncation flag.
- Exact URL / substantial title-word overlap skips likely duplicates. This is not
  semantic event deduplication; inspect that the two stories really are distinct.
- Two bounded top-sort discussion requests total, at most six substantive branches
  and two replies per branch. Author fields excluded; inline handles may remain in text.
- Failed/blocked/too-short/undated article candidates are recorded and skipped within
  the six-candidate budget, never reloaded or bypassed. Rate limits and lost tab
  ownership abort. Owned tabs close in finally; other tabs are never guessed or closed.
- If two usable stories cannot be collected, fail without replacing the old packet.
  No model fallback to titles alone, silent source refresh, or automatic model retries.
- This is a workstation browser transport, not an anonymous/global news ranking or a
  production server crawler. Public-hostname filtering is conservative but is **not**
  a server-side DNS/SSRF sandbox. Do not expose arbitrary-URL collection as a service.
- Readable article/main paragraphs do not prove complete reporting or independent
  corroboration. Cookie banners, related text, missing context and partial paywalls
  can defeat heuristics. Human source and factuality review remain necessary.
- Single-publisher claims and top-comment sentiment are distinct evidence, not truth
  by popularity. Publication recency does not guarantee an event itself is new.

Collection writes only headline context. Generation never touches the browser,
weather input or original Reddit context. Raw model drafts and uncertainty remain
visible: do not silently rewrite a passage to hide a factual or stylistic miss.

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
- `weather.ts`: typed weather source, NWS collector, reports, forecast selection and prompt seeds.
- `weatherCli.ts`: weather collect/note/show/generate; model selection is explicit.
- `headlines.ts`: typed reporting/discussion packets, validation, frozen input and story seeds.
- `headlineBrowser.ts`: bounded feed/article/discussion collection and owned-tab cleanup.
- `headlinesCli.ts`: headline collect/show/generate; user-selected Sol 6.1 low defaults.
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
ID reservation/failure isolation, and interruption/failure retention. Weather tests
cover public-request boundaries, source attribution, local-date selection, missing
forecast rejection, five isolated roles, role-specific input projection, rejected mode/voice
combinations, dry-run matrix validation, and immutable legacy/current weather replay.
Headline tests cover candidate filtering/duplicates, publication evidence, public-URL
checks, reporting/discussion separation, caps, ownership/rate-limit aborts, frozen reuse,
role isolation, dry-run defaults and immutable replay. Fixtures/fake transports only:
tests never call Reddit, publishers, NWS or an LLM.

The eventual first menu entry is exactly `QUICK PLAY (DAILY GEN AI)`: Helena today +
extended weather, two news stories and two buzz topics, with varied voices. Weather
presenters include the location naturally and accurately deliver the forecast;
human-reaction passages omit the location. One collection refresh
on launch-days, not necessarily one model call; no unattended daily scheduler.
Keep classic gameplay responsive and generate in parallel for the game. None of
that integration is implemented yet.
