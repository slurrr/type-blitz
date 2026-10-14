# Daily passage voice experiment

Standalone; nothing in this module is imported by the game. First prove the writing,
then integrate it. No scheduler, daily cache policy, weather collector, or new menu yet.

## Try it

Requires the existing `bb-browser` with a running accessible browser, and the globally
installed `@earendil-works/pi-coding-agent` with an OpenAI/Codex login. No new credentials
are required on this workstation. The prototype does not install either tool or alter
browser/account configuration.

From the repository root:

```sh
# One bounded Reddit collection. Existing context is reused without any browser access.
npm run daily:preview -- collect

# Inspect the frozen discussion; no network/model calls.
npm run daily:preview -- show

# Initially make three independent calls on that same input.
npm run daily:preview -- generate

# Edit prompts/daily/student.md, then explicitly replace just that voice's last attempt.
npm run daily:preview -- generate student --replace

# Explicit model/thinking comparison, still using the same frozen input.
npm run daily:preview -- generate student --model gpt-5.6-luna --thinking high --replace

# Only when you actually want new source material:
npm run daily:preview -- collect --refresh
```

Defaults: **openai-codex/gpt-5.6-luna, xhigh reasoning**. `--thinking` accepts low,
medium, high, xhigh. Model IDs must be physical OpenAI/Codex models in the installed
Pi catalog; a listing alone does not guarantee the subscription backend accepts one.
There is no model fallback or automatic retry. Each call times out after five minutes.

`student`, `blogger`, `satirist`, or `all` select calls. Omitting the voice means all.
Existing attempts require `--replace`, including failed/interrupted attempts. `show`
is always read-only. Invoking the command without a subcommand only displays help.

## Small, visible artifacts

Default: `~/runs/type-blitz/daily-preview/`. Override with `--dir <path>` before the
subcommand, or `TYPE_BLITZ_DAILY_DIR`. Keep generated state outside the source repo.

- `context.json`: one frozen topic and its cleaned comment branches.
- `student.json`, `blogger.json`, `satirist.json`: latest explicit attempt per voice.
  Includes exact instructions/input, source SHA256, model/thinking, timestamp, duration,
  token usage, raw prose, normalized ordinary `Passage`, and payload-isolation audit.
- `.lock`: only while collecting/generating. Contains the process PID. After interruption,
  check that PID before manually removing a stale lock. There is no background worker.

A refresh replaces the packet, not the samples. `show` labels samples with a different
source hash as stale instead of mixing experiments. Explicit replacement overwrites the
selected voice's old result; there is intentionally no automatic archive/database.

Generated prose is retained without an LLM rewrite/evaluator. Simple typography is
normalized for typing. Empty, multiline, non-ASCII or formatted output is flagged as
an error with raw output retained; a length outside 45–60 words is a visible warning.
Errors are recorded per voice, so one failure doesn't hide other successful samples.

Token counts describe subscription usage, not a dollar invoice. Output tokens can
include model reasoning. No credentials, headers, hidden reasoning or agent sessions
are saved in these artifacts.

## Boundaries

- `reddit.ts`: pure eligibility and cleanup functions. Frozen typed input is
  `SourcePacket`; post claims are separate from comments/replies and their votes.
- `browser.ts`: fixed browser commands and JSON reads. Exactly one feed navigation
  (first 25 popular/hot posts), then one comments request for the selected post
  (`sort=top`, bounded limit/depth). No recursive `more` downloads, page reloads,
  browser agent, account changes, or HTTP retries. The owned tab is targeted by ID
  and closed in `finally`; other tabs are untouched.
- `pi.ts`: replaceable `Writer.generate({ systemPrompt, userPrompt })` transport.
  Uses **Pi's ModelRuntime directly**, not AgentSession/CLI. No resource discovery,
  coding prompt, settings, skills, extensions, tools, memory, prompt templates, or
  automatically appended instructions. Default model overrides are not loaded.
- `preview.ts`: frozen input, editable prompts, latest-attempt persistence, validation
  and human-readable output. It cannot fetch Reddit during generation.
- `../dailyPreview.ts`: CLI composition, three concurrent independent calls.
- `../../prompts/daily/`: `shared.md` is format/source-handling guidance; each voice
  has its own short file. Every request receives shared + only that voice, never the
  other samples or voice prompts. The identical source packet is the user message.

Pi is loaded from the global npm package directory, avoiding a coding-agent dependency
in the game. For a different installation, set `TYPE_BLITZ_PI_ROOT` to the Pi package
root containing `package.json` and `dist/index.js`. Pi owns normal credential resolution
and OAuth refresh; the prototype never exports tokens. It uses the provider's normal
subscription transport. A normal API transport can later replace `pi.ts` without
changing source extraction, prompts or the game.

Before sending each request, `onPayload` asserts the actual provider payload has exactly
the intended instructions and single user input, no tools, no stored response, and the
requested thinking level. Unexpected injection or silent reasoning downgrades fail
closed. There is no agent loop or generation-recovery loop.

## Extraction limits and account care

The selection rule is conservative and mechanical, not a semantic classifier. It looks
for a recent (72-hour) post with 20+ comments and descriptive text; removes deleted/
moderator/bot material, duplicate comments and image-only replies; keeps up to six
substantive top-level comments and two replies each with their parent relationship.
Media posts require substantial post text. No article or media interpretation is attempted.
A recent post need not describe a newly occurring event. Inspect the packet before writing.

This uses public `r/popular/hot`, **not the account's home feed or subscriptions**, but
browser/session/region effects are not ruled out. Do not present a top-comment sample
as universal public consensus. Post text and comments are not independently verified.

The first browser trial exposed two transport issues now handled locally: navigation
can destroy the initial blank document before JSON is ready (bounded DOM readiness
checks, no new HTTP requests), and bb-browser can truncate large piped stdout on exit
(a temporary regular output file is parsed and deleted instead). Blocks/login pages
stop collection; there is no anti-bot workaround or retry loop. Freeze once, then do
all voice/model iteration offline from Reddit. This is not a server-ready access design.

## Tests and future direction

`npm run build && npm test` includes fixture/fake-transport tests for extraction,
reply relationships, cleanup, bounds, tab ownership/readiness/failure cleanup, frozen
input reuse, independent voice contexts, outgoing payload isolation, exact thinking
selection, per-voice reruns and failed generation. Tests do not call Reddit or an LLM.

After writing quality is proven, the intended first game menu entry is exactly
`QUICK PLAY (DAILY GEN AI)`. Its separate mode would consume ordinary passages:
Helena, Montana weather today + extended forecast, two distinct headlines, and two
buzz topics, with different voices/perspectives. Weather must start with the location
and accurately deliver the forecast; it can simply sound like a local weather anchor.

One collection refresh on days the user actually launches the game, not one mandatory
model call and not an unattended daily scheduler. Six calls are fine if useful. Keep
classic play responsive while generation happens in the background. None of that is
implemented by this prototype.
