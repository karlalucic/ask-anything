# Architecture & stack — a guided tour

This document explains how `ask-anything` is built: what each piece does, why it's there, and where to read the actual code. It assumes you know programming fundamentals (async/await, HTTP, SQL, types) but not necessarily modern web/cloud patterns.

The goal isn't comprehensive reference docs — it's a mental model. After reading this you should be able to open any file in the repo and understand what role it plays in the bigger picture.

---

## What the app actually does

A user opens the app, fills in a wizard ("I want a 30-minute briefing on the Dutch Republic, intermediate familiarity, in the style of Michael Lewis, narrated by Ara"), clicks **Generate**, and ~10 minutes later has a finished MP3 they can listen to in the browser.

Behind that single click, the system:

1. Asks Claude to plan a chapter outline.
2. For each chapter, runs a multi-step research loop where Claude searches the web and gathers evidence.
3. For each chapter, drafts narrative prose based on the research.
4. Aggregates and polishes the chapters into a single coherent script.
5. Sends the script in pieces to xAI's TTS to synthesize voice audio.
6. Stitches the audio chunks together with `ffmpeg`.
7. Uploads the final MP3 to storage and notifies the browser.

This entire pipeline takes long enough that it can't run inside a normal HTTP request. Most of the architectural decisions in this app exist to handle that one fact.

---

## The stack at a glance

| Layer | Technology | Role |
|---|---|---|
| Frontend framework | [Next.js 16](https://nextjs.org/) (App Router) + React 19 | UI rendering (both server-side and in the browser). |
| Hosting | [Vercel](https://vercel.com/) | Runs the Next.js app and its API routes as serverless functions. |
| Database + Auth + Storage + Realtime | [Supabase](https://supabase.com/) (Postgres) | Stores users, generations, chapters, audio files; handles login; pushes live progress updates. |
| Background jobs | [Trigger.dev v4](https://trigger.dev/) | Runs the long-running generation pipeline outside Vercel's request timeout. |
| LLM provider | [Anthropic Claude](https://www.anthropic.com/) | Outline, research, drafting, aggregation. |
| TTS provider | [xAI](https://x.ai/) | Text-to-speech voice synthesis. |
| Audio stitching | `ffmpeg` | Concatenate TTS chunks into one MP3. Runs inside Trigger.dev workers. |
| UI components | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Styling and base components. |
| Validation | [Zod](https://zod.dev/) | Type-safe runtime validation of API request bodies. |

Source of truth for these versions: [package.json](../package.json).

---

## The mental model

Picture the system as four layers, each with a different lifetime and trust level.

```
┌───────────────────────────────────────────────────────────────┐
│  Browser (the user)                                           │
│  — runs React components                                      │
│  — has a session cookie                                       │
└──────┬──────────────────────────────────────────────────┬─────┘
       │ HTTPS                                            │ WSS
       ▼                                                  ▼
┌───────────────────────────────────────┐    ┌────────────────────────┐
│  Next.js on Vercel                    │    │  Supabase Realtime     │
│  — server components (initial render) │    │  — pushes live updates │
│  — API routes (POST /api/...)         │    │    when DB rows change │
│  — proxy.ts middleware (auth)         │    │                        │
└──────┬─────────────────────┬──────────┘    └──────▲─────────────────┘
       │                     │                      │
       │ Postgres            │ tasks.trigger()      │ NOTIFY
       ▼                     ▼                      │
┌────────────────────┐  ┌───────────────────────────┴──────────┐
│  Supabase Postgres │  │  Trigger.dev workers                 │
│  — generations     │  │  — generate-audiobook (orchestrator) │
│  — chapters        │  │  — chapter-research (per chapter)    │
│  — provider_usage  │  │  — chapter-draft (per chapter)       │
│  — auth.users      │  │  — tts-chunk (per audio chunk)       │
│  — storage buckets │  │                                      │
└────────────────────┘  └─────┬─────────────┬────────┬─────────┘
                              │             │        │
                              ▼             ▼        ▼
                         Anthropic       xAI TTS  Supabase
                         (LLM API)                (writes)
```

Two things are important here:

1. **The browser never talks to Trigger.dev or to Anthropic directly.** It only talks to Next.js and to Supabase Realtime. Secrets stay server-side.
2. **There are two separate compute environments running your code:** the Next.js process on Vercel (handles HTTP requests, fast) and Trigger.dev workers (handle long-running pipelines, slow but durable). They communicate through Postgres — the database is the shared memory.

That second point is the key insight of the architecture. If you understand "Next.js writes a row, Trigger.dev reads/updates rows, the browser watches rows change," you understand 90% of the system.

---

## Walking through one generation, end to end

Let's trace what happens when you click **Generate**. Open these files alongside the explanation.

### Step 1. The wizard collects the form

The user interacts with a multi-step form: [components/wizard/config-wizard.tsx](../components/wizard/config-wizard.tsx). This is a **client component** (note the `"use client"` directive at the top) — it has interactive state and runs in the browser.

When the user clicks "Generate briefing" on the review step, the component calls `handleGenerate()` ([config-wizard.tsx:114-143](../components/wizard/config-wizard.tsx#L114-L143)) which `fetch`es the API.

### Step 2. The API route validates and writes a row

The browser hits `POST /api/generations`. That endpoint is in [app/api/generations/route.ts](../app/api/generations/route.ts).

Three things happen here:

- **Auth check** ([route.ts:34-36](../app/api/generations/route.ts#L34-L36)): the route asks Supabase "who is this user?" using the session cookie. If unauthenticated, it returns 401.
- **Schema validation** ([route.ts:38-45](../app/api/generations/route.ts#L38-L45)): the request body is parsed with Zod. If the shape is wrong, the route returns 400 with a readable error message.
- **DB insert** ([route.ts:47-64](../app/api/generations/route.ts#L47-L64)): a new row goes into the `generations` table with `status = 'queued'`. The DB returns the row's UUID.
- **Trigger the job** ([route.ts:70-80](../app/api/generations/route.ts#L70-L80)): the route calls `tasks.trigger("generate-audiobook", {...})`. This sends a message to Trigger.dev's queue and returns immediately. The HTTP response goes back to the browser within a couple of hundred milliseconds.

The browser then redirects to `/listen/<id>` ([config-wizard.tsx:138](../components/wizard/config-wizard.tsx#L138)), where the user watches the generation progress in real time.

### Step 3. The orchestrator picks up the job

A Trigger.dev worker pulls the job from the queue and starts running [trigger/generate-audiobook.ts](../trigger/generate-audiobook.ts). This is a **separate process** from the Next.js app — it's a Node.js worker on Trigger.dev's infrastructure with `ffmpeg` baked in.

The orchestrator runs the five-stage pipeline. Each stage updates the `generations.status` column so the browser can see what's happening.

#### Stage 1: outline ([generate-audiobook.ts:78-110](../trigger/generate-audiobook.ts#L78-L110))

The orchestrator builds a prompt asking Claude for a chapter outline and calls the Anthropic API. The response is JSON describing N chapters with titles, theses, research briefs, and search queries. This is parsed and saved to `generations.outline`.

The prompt-building code lives in [lib/prompts/outline.ts](../lib/prompts/outline.ts). Keeping prompts in their own files (rather than inlined in the trigger code) makes it easy to iterate on them without touching the orchestration logic.

#### Stage 2: research ([generate-audiobook.ts:148-160](../trigger/generate-audiobook.ts#L148-L160))

For each chapter, the orchestrator calls a separate Trigger task — [trigger/chapter-research.ts](../trigger/chapter-research.ts) — using `tasks.triggerAndWait`. This blocks the orchestrator until the child task completes, but it lets the child run with its own retry budget and isolation.

Inside the research task, Claude is given a `web_search` tool and runs an **agentic loop**: search → read results → search again → eventually call a `done` tool to return findings. This loop is currently bounded by `MAX_ITERATIONS = 5` ([chapter-research.ts:10](../trigger/chapter-research.ts#L10)).

This stage is the most expensive part of a generation by far, which is why a chunk of the planned work targets it (see [docs note at the end](#whats-evolving)).

#### Stage 3: drafting ([generate-audiobook.ts:170-181](../trigger/generate-audiobook.ts#L170-L181))

For each chapter, the orchestrator calls [trigger/chapter-draft.ts](../trigger/chapter-draft.ts), passing in the research findings + the user's `styleCard`. Claude turns the research into narrative prose. The output is saved to `chapters.draft`.

#### Stage 4: aggregation ([generate-audiobook.ts:183-220](../trigger/generate-audiobook.ts#L183-L220))

The orchestrator concatenates all the chapter drafts and asks Claude to polish them into a single coherent script with smooth transitions. Saved to `generations.full_script`.

#### Stage 5: TTS + stitching ([generate-audiobook.ts:222-300](../trigger/generate-audiobook.ts#L222-L300))

The full script is split into ~12,000-character chunks (xAI has a per-request size limit). For each chunk, the orchestrator calls [trigger/tts-chunk.ts](../trigger/tts-chunk.ts), which posts to xAI's TTS API and uploads the resulting MP3 to a private `tts-chunks` Supabase Storage bucket.

After all chunks are uploaded, the orchestrator downloads them, runs `ffmpeg -f concat -c copy` to stitch them into one file (no re-encoding — fast), uploads the final MP3 to the public `audio` bucket, and updates `generations.status = 'complete'`.

### Step 4. The browser sees it finish

While all this was happening, [components/generation-progress.tsx](../components/generation-progress.tsx) was subscribed to Supabase Realtime ([:52-71](../components/generation-progress.tsx#L52-L71)). Every time the orchestrator updated the `generations` or `chapters` row, Supabase pushed the change to the browser over a WebSocket and the React component re-rendered.

When `status` becomes `complete`, the [listen page](../app/listen/[id]/page.tsx) shows the audio player with the final MP3. Done.

---

## Key concepts explained

This section unpacks the patterns that show up throughout the codebase. Each one solves a specific problem; understanding the problem makes the code easier to read.

### Server components vs client components

Next.js 16's App Router lets you write React components that run *only on the server* (server components) or in both the server and the browser (client components). The difference is:

- **Server components** can directly query a database, read environment variables, and run secret-key code. They're rendered to HTML on the server and sent to the browser. They cannot use `useState`, `useEffect`, or browser-only APIs.
- **Client components** are marked with `"use client"` at the top. They render in the browser, can have interactive state, but cannot directly access secrets or the database — they have to call API routes for data.

Concrete examples in this repo:

- [app/listen/[id]/page.tsx](../app/listen/[id]/page.tsx) is a **server component**. It fetches the generation row directly from Supabase using a server client ([:13](../app/listen/[id]/page.tsx#L13)) and renders the initial HTML. The user gets a fully-formed page on first load — no spinner.
- [components/generation-progress.tsx](../components/generation-progress.tsx) is a **client component** (`"use client"` on line 1). It has to be — it needs `useState` and `useEffect` to subscribe to Realtime and re-render when progress changes. The server component above includes this client component as a child.

This split (initial render on the server, interactivity in the browser) is the whole point of the React Server Components architecture: fast first paint + dynamic updates without sending all your data-fetching code to the browser.

### Auth: Supabase + JWT cookies

When a user logs in via [app/login/login-form.tsx](../app/login/login-form.tsx), Supabase issues a JWT (JSON Web Token) and stores it in an HTTP-only cookie. Every subsequent request to the Next.js server includes this cookie automatically.

Two helpers in [lib/supabase/server.ts](../lib/supabase/server.ts) wrap this:

- `createSupabaseServerClient()` ([:5-28](../lib/supabase/server.ts#L5-L28)) — a Supabase client that knows how to read the cookie. Use this in server components and API routes when you want queries to run *as the logged-in user* (so RLS policies apply — see next section).
- `createSupabaseServiceClient()` ([:31-36](../lib/supabase/server.ts#L31-L36)) — a Supabase client using the service-role key, which bypasses RLS. Use this only when you legitimately need cross-user access (e.g., the admin dashboard, or background jobs writing on behalf of any user).

The middleware [proxy.ts](../proxy.ts) (Next.js 16 renamed `middleware.ts` to `proxy.ts`) runs before every request. It refreshes the session cookie when needed so users stay logged in.

### Security: Row Level Security (RLS)

Supabase Postgres has a feature called Row Level Security. Instead of your application code being responsible for "this user can only see their own generations," you write that rule directly in the database, and Postgres enforces it on every query.

Example from [supabase/migrations/0001_init.sql:116-120](../supabase/migrations/0001_init.sql#L116-L120):

```sql
create policy "generations: owner read/write"
  on generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

This says: "for any operation on the `generations` table, the row's `user_id` must match the JWT's user ID." If a logged-in user tries to read someone else's generation, Postgres returns zero rows — without your application code having to check.

The pattern is: **trust nothing in the application code; enforce everything at the DB**. If a future bug in an API route forgets to check ownership, RLS still protects the data.

The `service_role` key bypasses RLS, which is why we're careful about where we use it. Trigger.dev workers use it (they need to update any user's generation), and the admin dashboard uses it (it needs to see across users). Most other code paths use the user-scoped client.

### Why a separate job runner (Trigger.dev)

Vercel's serverless functions have an execution timeout — currently 300 seconds on most plans. A briefing generation takes 5–10+ minutes. So generation cannot run inside an HTTP request.

Common patterns for this problem:

- **Background queues** (SQS, BullMQ, Inngest, Trigger.dev): persist a "do this work" message to durable storage; a separate worker process reads the queue and runs the job; results land back in the database.
- **Vercel Cron**: schedule a function to run periodically. Useful for housekeeping; not for one-off long jobs.
- **Roll-your-own worker on a VM**: cheapest in $/month but you're now operating infrastructure.

This app uses Trigger.dev because:

- It's built specifically for AI workloads — long-running, retry-aware, structured logging out of the box.
- Tasks are defined as TypeScript functions colocated with the rest of the codebase ([trigger/](../trigger/)). Tooling can typecheck the whole pipeline.
- It supports `triggerAndWait` so the orchestrator task can call child tasks synchronously (programming model stays simple) while still running them in separate worker processes.
- Its config file [trigger.config.ts](../trigger.config.ts) bakes `ffmpeg` into worker images via a build extension — saves us from setting up a custom Docker image.

The orchestrator → child task pattern in [trigger/generate-audiobook.ts](../trigger/generate-audiobook.ts) treats Trigger.dev like a job DAG: outline runs once, research runs N times in a loop, draft runs N times, TTS runs M times. Each child has its own retry policy, its own logs, and can fail independently.

### Idempotency

If a worker crashes halfway through a generation, Trigger.dev retries the task. The retry must not duplicate side effects (don't pay Anthropic twice for the same chapter; don't double-upload the same audio).

Two layers of defense:

1. **DB-level checks** in each child task. For example, [chapter-research.ts:25-35](../trigger/chapter-research.ts#L25-L35) starts by querying the chapter row: if `research` is already set and `status` is past `researching`, it returns the cached result instead of re-calling Anthropic. Same for [chapter-draft.ts](../trigger/chapter-draft.ts) and [tts-chunk.ts](../trigger/tts-chunk.ts).
2. **Trigger.dev `idempotencyKey`** — when a task is triggered with an idempotency key, Trigger.dev guarantees it won't run twice even if the trigger call is duplicated. (Currently underused; the planned Phase 2 work adds explicit idempotency keys per child invocation.)

The general principle: **assume any operation can run twice.** Design every operation to be safe to repeat — either by detecting "already done" and short-circuiting, or by being naturally idempotent (e.g., `UPDATE ... SET status='done'` is idempotent; `INSERT` is not unless you have a UNIQUE constraint to lean on).

### Realtime updates

How does the browser know when the orchestrator has finished an outline, or when chapter 3's draft is done?

Supabase has a feature called **Realtime** that watches the Postgres write-ahead log and pushes changes to subscribed clients over a WebSocket. The browser opens two channels in [components/generation-progress.tsx:52-71](../components/generation-progress.tsx#L52-L71):

```ts
supabase
  .channel(`generation:${generationId}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "generations",
    filter: `id=eq.${generationId}`,
  }, (payload) => { /* update React state */ })
  .subscribe();
```

This says "tell me whenever the generation row with this ID gets updated." When the orchestrator runs `update generations set status = 'researching'`, Supabase pushes the new row to the browser within milliseconds and the UI re-renders.

There's also a fallback poll every 10 seconds ([:74-78](../components/generation-progress.tsx#L74-L78)) in case the WebSocket connection drops. The Realtime channel is the fast path; the poll is the safety net.

This pattern (database-as-event-bus) is convenient at small scale but doesn't scale to many users — each subscriber holds a Postgres replication slot, and updates fan out to every connected client. The planned Phase 6 work moves this to Supabase Broadcast, which scales horizontally.

### Cost telemetry

Recently added in Phase 0.A:

- [supabase/migrations/0004_provider_usage.sql](../supabase/migrations/0004_provider_usage.sql) — defines a `provider_usage_events` table with one row per Anthropic / xAI / Perplexity call. Token counts, web search counts, characters, computed cost in USD.
- [lib/billing/pricing.ts](../lib/billing/pricing.ts) — a small lookup table mapping `(provider, model)` to `$ per 1M tokens`. Anthropic prompt-cache math is fiddly; that file documents how it works.
- [lib/usage/record.ts](../lib/usage/record.ts) — a helper that inserts a row into `provider_usage_events` after each provider call. Failures are swallowed so a telemetry hiccup never breaks the generation pipeline.
- [app/admin/cost/page.tsx](../app/admin/cost/page.tsx) — an admin-gated dashboard (`ADMIN_USER_IDS` env var) that shows recent generations with their per-stage cost breakdown.

The reason this exists: before Phase 0.A, no one knew what a generation actually cost. The user reported "~$9 per 10-minute briefing" while a code-level analysis estimated "~$0.70." Neither number was trustworthy. The instrumentation resolves that argument with hard data, which is the prerequisite for setting prices.

The principle is broader: **measure first, optimize second.** Adding observability before changing models or providers means every later optimization can be evaluated against a real baseline rather than a guess.

---

## Why this stack

For each component, the question "why this rather than something else" is worth answering, because most of these choices are *tradeoffs*, not obvious wins.

### Next.js + Vercel

The combination is the path of least resistance for a TypeScript + React + serverless web app in 2026.

- The **App Router** model (server components + client components in one tree) is awkward at first but eliminates a whole category of "we need a separate API for the frontend" boilerplate. Server components fetch data directly; client components only ship to the browser when interactivity demands it.
- **Vercel** is the company that builds Next.js, so deployment is a `git push` away and the framework is tuned to Vercel's edge network and Fluid Compute runtime.

The main tradeoff is **vendor lock-in to Vercel-flavored hosting**. The Next.js code itself is portable in theory, but in practice features like `proxy.ts`, ISR, image optimization, and OG image routes assume Vercel's runtime. If you needed to migrate off, it's a non-trivial port.

For a hobby/SaaS-scale product, this lock-in is acceptable. For something where infrastructure independence matters (regulated industries, very cost-sensitive at high traffic), it might not be.

### Supabase

Supabase bundles four things that most apps need: Postgres, auth, file storage, and realtime change-data-capture. Buying these together saves a meaningful amount of integration work compared to:

- Postgres on RDS / Neon / Crunchy
- Auth via Auth0 / Clerk / NextAuth
- Storage on S3 / R2
- Realtime via Pusher / Ably / your own WebSocket server

The cost is **less control over each layer**. RLS is great until you need a query pattern it doesn't express well; Supabase Auth is great until you need a custom OAuth flow; Realtime is great until you hit its scaling limits.

For this app, every Supabase feature is being used and the tradeoffs are favorable. At ~100k+ users, some of these (especially Realtime and Storage egress) start to bite, which is why the scaling plan in [snazzy-rolling-wirth.md](../../.claude/plans/snazzy-rolling-wirth.md) augments rather than replaces them (Broadcast instead of postgres_changes; R2 for audio at scale).

### Trigger.dev v4

The honest comparison is against Inngest and Vercel Queues. All three solve "long-running background jobs in TypeScript with retries and observability."

- **Trigger.dev** has the strongest story for AI workloads: built-in support for streaming, machine-size selection per task, build extensions like the `ffmpeg` one this app uses ([trigger.config.ts:21](../trigger.config.ts#L21)). Pricing scales with compute use.
- **Inngest** is more event-driven (subscribe to events, react). Comparable feature set; different idioms.
- **Vercel Queues** is newer (public beta), tightly integrated with Vercel.

This app picked Trigger.dev. The framing is: "the orchestration code lives in the same repo, typechecked end-to-end, and the workers can run heavyweight stuff like ffmpeg without me building Docker images." That's the exact value Trigger.dev sells.

### Anthropic Claude

For long-form prose, citation handling, and tool use, Claude has been consistently strong. The current pipeline uses three model tiers:

- **Sonnet 4.6** — outline, research, aggregation. Fast, capable, $3/$15 per 1M tokens (input/output).
- **Opus 4.7** — chapter drafting. Slower, the highest-quality writing, $5/$25 per 1M tokens.
- **Haiku 4.5** — style card analysis. Cheapest, used for small focused tasks, $1/$5 per 1M tokens.

Why Anthropic vs OpenAI vs Google: **product fit + the web_search tool**. Claude's `web_search_20250305` tool lets the model do its own searches inside an agentic loop — convenient, though expensive (see the cost story). For a quality-first audio briefing, Claude's prose is currently the bar to beat.

The planned bakeoff in Phase 0.D will test whether **Perplexity Sonar** (purpose-built for cited search synthesis) plus **Claude for synthesis** beats Claude doing everything itself. That's an open question; the instrumentation is there to answer it with data.

### xAI for TTS

xAI's TTS produces high-quality voices at competitive pricing. Alternatives considered: ElevenLabs (more expensive, comparable quality), OpenAI TTS (cheaper, less voice variety), open-source models (cheapest, more setup).

For a ~10-minute audio product where voice quality is part of the brand, paying for hosted high-quality TTS is the right tradeoff. The voices are configured in [lib/types.ts](../lib/types.ts) (`VOICE_LABELS`) and the voice ID is sent in the API request at [tts-chunk.ts:57-62](../trigger/tts-chunk.ts#L57-L62).

### ffmpeg

Standard for audio/video manipulation. Used here only to concatenate MP3 chunks into one file, with `-c copy` (no re-encoding) for speed. Trigger.dev's `ffmpeg()` build extension ([trigger.config.ts:21](../trigger.config.ts#L21)) installs it into the worker image automatically.

### Tailwind CSS + shadcn/ui

Tailwind for utility-first styling means CSS lives next to the markup it styles, and the design system is enforced through a constraint set (no random hex colors). shadcn/ui provides unstyled component primitives (Button, Slider, Input) that the app then themes. The combination keeps the design coherent without writing a custom component library from scratch.

### Zod

Zod validates runtime data and produces TypeScript types from a single source. You see it most often at API boundaries — e.g., [app/api/generations/route.ts:8-31](../app/api/generations/route.ts#L8-L31) defines the body schema once, then `safeParse` checks the incoming JSON. If parsing fails, the route returns a readable error.

Why this matters: TypeScript types are erased at runtime. Without runtime validation, a malformed JSON body silently becomes garbage data inside your app. Zod closes that gap.

---

## Reading guide: where to start

The repo has ~50 files. Here's the order to read them if you want to internalize the architecture:

### Tier 1 — the path of one generation (read these first)

1. [components/wizard/config-wizard.tsx](../components/wizard/config-wizard.tsx) — what the user sees and what they submit.
2. [app/api/generations/route.ts](../app/api/generations/route.ts) — the API entry point. Validation, auth, DB insert, job trigger.
3. [trigger/generate-audiobook.ts](../trigger/generate-audiobook.ts) — the orchestrator. The whole 5-stage pipeline.
4. [trigger/chapter-research.ts](../trigger/chapter-research.ts) — one child task in detail. Note the agentic loop and idempotency check.
5. [components/generation-progress.tsx](../components/generation-progress.tsx) — how the browser watches the job complete.
6. [app/listen/[id]/page.tsx](../app/listen/[id]/page.tsx) — the listen page (server component) that hosts the progress component and the audio player.

### Tier 2 — the supporting machinery

7. [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) — the schema. Tables, indexes, RLS policies, the orphan-sweeper cron.
8. [lib/supabase/server.ts](../lib/supabase/server.ts) — the two Supabase clients (user-scoped vs service-role).
9. [proxy.ts](../proxy.ts) — Next.js middleware for session refresh.
10. [trigger.config.ts](../trigger.config.ts) — Trigger.dev config including the ffmpeg build extension.
11. [lib/prompts/](../lib/prompts/) — every Claude prompt lives here. Worth skimming all of them; the prompts are what makes the output good.
12. [lib/supabase/progress.ts](../lib/supabase/progress.ts) — helpers for updating generation/chapter status from inside trigger tasks.
13. [lib/errors.ts](../lib/errors.ts) — the `AppError` class that carries structured failure info from workers up to the user.

### Tier 3 — the new cost telemetry (Phase 0.A)

14. [supabase/migrations/0004_provider_usage.sql](../supabase/migrations/0004_provider_usage.sql) — the new table.
15. [lib/billing/pricing.ts](../lib/billing/pricing.ts) — provider rate cards.
16. [lib/usage/record.ts](../lib/usage/record.ts) — the helper that writes a usage row.
17. [app/admin/cost/page.tsx](../app/admin/cost/page.tsx) — the admin dashboard.

### Tier 4 — surface area (skim as you encounter it)

- [app/library/page.tsx](../app/library/page.tsx) — the list of past generations.
- [app/api/generations/[id]/](../app/api/generations/[id]/) — endpoints for cancel, resume, share, feedback, audio-url.
- [components/audio-player.tsx](../components/audio-player.tsx) — the custom audio UI.
- [app/s/[token]/page.tsx](../app/s/[token]/page.tsx) — the public share page.

---

## Patterns that come up repeatedly

A few coding habits worth noticing because they'll appear over and over:

### "Validate at the boundary, trust within"

Every API route does Zod validation on the incoming body and an auth check at the top. After those two pass, the rest of the function trusts the data. Internal functions don't re-validate. The boundary between "outside world" and "trusted code" is the first ~10 lines of every route.

### Throwing typed errors (`AppError`)

Workers throw [AppError](../lib/errors.ts) instances with structured fields: `stage`, `provider`, `code`, `retriable`, `attempt`, `generationId`. The orchestrator's catch block at [generate-audiobook.ts:303-323](../trigger/generate-audiobook.ts#L303-L323) reads those fields, writes them to `generations.error`, and lets the browser surface them in the UI. Errors aren't free-form strings — they're data the rest of the system can act on.

### "Service role only when necessary"

Most code uses the user-scoped Supabase client (RLS protects you). Only specific places escalate to the service-role client: trigger workers (need cross-user write access), the public share page (looking up generations by share token), and the admin cost dashboard. Each escalation is a deliberate decision visible in the code.

### "DB row is the source of truth"

`generations.status` is the canonical state of a job. Trigger.dev's `trigger_run_id` is just metadata; the browser doesn't watch Trigger.dev — it watches the row. This makes the system robust to Trigger.dev being unavailable: the row still tells you the last-known state, and a scheduled sweeper ([0001_init.sql:332-349](../supabase/migrations/0001_init.sql#L332-L349)) marks abandoned rows as failed.

---

## What's evolving

This document describes the app *as it is right now*. There's a forward-looking plan in [.claude/plans/snazzy-rolling-wirth.md](../../.claude/plans/snazzy-rolling-wirth.md) that walks through how the system will change over the next few weeks:

- **Phase 0** — instrument every provider call (just shipped), then run controlled bakeoffs to decide whether to keep Claude's web_search or move research to Perplexity, and whether to keep Opus 4.7 drafts or downgrade to Sonnet 4.6. **Quality-first**, not cost-first.
- **Phase 1** — Stripe integration with a credits-as-wallet model. Per-generation pricing scaled to audio length.
- **Phase 2** — rate limiting via Upstash Redis.
- **Phase 3** — pipeline parallelization (chapters in parallel rather than sequential).
- **Phase 4** — Vercel AI Gateway for centralized provider observability and spend caps.
- **Phase 5–8** — DB write reduction, Realtime on Broadcast, audio on R2 with private signed URLs, auth/sharing UX polish.
- **Phase 9** — true 100k MAU readiness (load tests, runbooks, provider quota contracts).

Every pattern in this document still applies after those changes — they augment the architecture, they don't replace it.

---

## How to keep learning

If you want to go deeper on the patterns this app uses:

- **Next.js App Router** — read the official docs that ship in `node_modules/next/dist/docs/`. They're better than blog posts and version-correct.
- **Postgres + RLS** — Supabase has good explainer docs; the official Postgres docs cover RLS in detail.
- **Trigger.dev** — read [trigger.dev/docs](https://trigger.dev/docs) on tasks, queues, idempotency, and `triggerAndWait`.
- **Anthropic prompting** — Anthropic's prompt engineering docs are unusually good. The `web_search` tool docs explain the agentic loop pattern.
- **Distributed systems thinking** — *Designing Data-Intensive Applications* by Martin Kleppmann is the standard reference. It frames concepts like idempotency, retries, and write-ahead logs at the level you need to reason about systems like this one.

The shortcut for understanding any production-grade app is: **read the migration files first, then the API routes, then the workers.** That sequence (data shape → entry points → background processing) maps to almost every web-and-jobs system you'll encounter.
