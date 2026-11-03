# Crystal Ball Command Centre — Submission

## What's built

All five entry points from §1 are wired end-to-end (UI → API → AI layer → tests):

- **Present me Summary** — prioritises the live queue by urgency, streams back a typed `SummaryResponse`
- **Talk to me** — multi-turn conversation grounded in the queue
- **Help me** — RAG-grounded answer over `data/policy.md`, with citation validation
- **Teach me** — step-by-step walkthrough, adapts on follow-up
- **Replay Greeting** — context-aware greeting using live pending count

Each action is dispatched from `app/api/ai/[action]/route.ts`, hits a versioned prompt in `prompts/*.v1.ts`, and returns a Zod-validated payload (or a context-aware fallback) over SSE.

## Test evidence (§4)

Red-first commits are visible in `git log --oneline` — each `test(...)` commit precedes its `feat(...)` commit.

- **Jest unit** — 5 tests, mocked LLM, in `__tests__/unit/summary.test.ts`
- **Supertest integration** — 6 tests, covers 200 stream, timeout fallback, 401 fallback, 429 rate limit, 400 bad action
- **Vitest + RTL component** — 7 tests, covers structure, loading, streaming, error

`npm test` → 11 passing. `npm run test:ui` → 7 passing.

## Failure handling (§6) — captured live

**The Anthropic account used during development had zero credit balance**, so every action currently shows the fallback card. That's the §6 failure path, captured against a real `400 credit balance too low`, not a simulated failure.

- `docs/screenshots/fallback-live.png` — real 400 from Anthropic
- `docs/screenshots/timeout.png` — `TIMEOUT_MS = 50` forced
- `docs/screenshots/rate-limit.png` — 11th request in 60s → 429
- `docs/screenshots/tests-green.png` — both test tiers passing

No action ever returns a raw 500 or freezes the UI. The fallback is a **typed `FallbackResponse`** with a context-aware message built from the live queue.

## README highlights (§5, 150–250 words)

Full writeup is in `README.md`. The key judgment calls:

- **Replay Greeting is the clearest AI-unnecessary candidate** — a template `"You have N pending"` would work. It's AI-backed because the assignment lists it as an entry point, but the fallback is exactly that template.
- **Help me is AI-necessary *only* with grounding.** The handler rejects the model's response if it cites a chunk id that wasn't retrieved. That cross-object constraint can't be expressed in the schema alone.
- **Fallback design:** every LLM call is wrapped in `lib/llm.ts` with an 8s AbortController. Three failure modes (`timeout`, `invalid_shape`, `upstream_error`) all return the same typed fallback over SSE. The UI re-validates the `done` payload against Zod before rendering, so a shape regression degrades to a message rather than a crash.
- **One thing I'd do differently:** real token streaming at the SDK layer (`stream: true`) instead of chunking the validated payload. The current approach makes RTL component tests trivial, but adds ~300ms to first token.

## Assumptions (§4, challenge weak acceptance criteria)

- `"Pending Review — Sep 18"` split into `status: "Pending Review"` enum + `submittedAt: ISO 8601` date. A date embedded in a status string is unqueryable and untestable.
- Rate limiter is in-memory (10/60s), keyed by session cookie or IP. Not Redis — deliberately, per §3's "doesn't need to be production-grade, just present and explained."

## AI tooling (§7)

Claude Code for scaffolding, Cursor for component test iteration. Specific judgment calls made by me, not the tools:

- `extractJson` fence-stripper — written after observing real `invalid_shape` failures
- Citation-grounding check in `handleHelp` — the schema can't express "citation must be in the retrieved set"
- `var mockCreate` + lazy-arrow Jest fix — broke the TDZ cycle caused by `jest.mock` hoisting
- `jest.resolver.js` custom resolver — Jest 29's `moduleNameMapper` `$1` substitution is broken on Windows (jestjs/jest#11192)

## Run locally

```bash
npm install
cp .env.example .env.local    # add ANTHROPIC_API_KEY
npm run dev                   # http://localhost:3000