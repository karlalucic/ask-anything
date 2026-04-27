-- ─── provider_usage_events ──────────────────────────────────────────────────
-- One row per LLM/TTS/search provider call. Source of truth for unit economics.
-- Append-only; never updated. RLS denies all reads from authenticated clients —
-- only the service-role key can insert/select. The admin cost dashboard
-- gates by ADMIN_USER_IDS env var server-side and queries via service role.
--
-- generation_id and user_id are both nullable + on delete set null so cost
-- rows survive deletion of the parent generation/user (billing audit trail).
-- style_card / style_refine calls have no generation_id at the time of the
-- call (they happen pre-generation in the wizard) — user_id is populated.

create table if not exists provider_usage_events (
  id bigserial primary key,
  generation_id uuid references generations(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  chapter_idx int,
  stage text not null check (
    stage in ('outline','research','draft','aggregate','tts','style_card','style_refine','digest')
  ),
  provider text not null,
  model text not null,
  variant text,
  input_tokens int,
  output_tokens int,
  cached_input_tokens int,
  cache_creation_input_tokens int,
  tool_calls int not null default 0,
  web_search_requests int not null default 0,
  tts_characters int,
  cost_usd numeric(10, 6) not null default 0,
  duration_ms int,
  attempt int not null default 1,
  created_at timestamptz not null default now()
);

alter table provider_usage_events enable row level security;

-- No SELECT/INSERT policies for authenticated users → table is locked down.
-- Service role bypasses RLS for inserts (trigger tasks, API routes) and for
-- the admin dashboard query.

create index if not exists provider_usage_events_gen_idx
  on provider_usage_events(generation_id, created_at);
create index if not exists provider_usage_events_user_idx
  on provider_usage_events(user_id, created_at desc);
create index if not exists provider_usage_events_created_idx
  on provider_usage_events(created_at desc);
create index if not exists provider_usage_events_provider_idx
  on provider_usage_events(provider, model);
