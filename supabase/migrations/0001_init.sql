-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$
begin
  create type generation_status as enum (
    'queued','outlining','researching','drafting','aggregating','synthesizing','complete','failed','canceled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type duration_preset as enum ('short','medium','long');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type familiarity_level as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type intent_type as enum ('curious','work','comparing','deep_dive');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type voice_id as enum ('eve','ara','rex','sal','leo');
exception when duplicate_object then null;
end $$;

-- ─── Profiles ────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles: owner read/write" on profiles;
create policy "profiles: owner read/write"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Generations ─────────────────────────────────────────────────────────────

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  topic text not null,
  duration duration_preset not null,
  familiarity familiarity_level not null,
  intent intent_type not null,
  voice voice_id not null,
  style_input text not null,
  style_card jsonb,
  style_followups jsonb,
  sources_config jsonb not null,
  outline jsonb,
  full_script text,
  audio_path text,
  audio_duration_seconds int,
  status generation_status not null default 'queued',
  stage_progress jsonb not null default '{}'::jsonb,
  error jsonb,
  trigger_run_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table generations enable row level security;

drop policy if exists "generations: owner read/write" on generations;
create policy "generations: owner read/write"
  on generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists generations_user_idx on generations(user_id, created_at desc);
create index if not exists generations_active_idx on generations(status)
  where status in ('queued','outlining','researching','drafting','aggregating','synthesizing');

-- ─── Chapters ────────────────────────────────────────────────────────────────

create table if not exists chapters (
  generation_id uuid not null references generations(id) on delete cascade,
  idx int not null,
  title text not null,
  thesis text,
  research_brief text,
  search_queries text[],
  evidence_needed text[],
  target_words int,
  research jsonb,
  draft text,
  status text not null default 'pending',
  error jsonb,
  updated_at timestamptz not null default now(),
  primary key (generation_id, idx)
);

alter table chapters enable row level security;

drop policy if exists "chapters: owner read via generations" on chapters;
create policy "chapters: owner read via generations"
  on chapters for select
  using (
    exists (
      select 1 from generations
      where generations.id = chapters.generation_id
        and generations.user_id = auth.uid()
    )
  );

-- ─── Run Events ──────────────────────────────────────────────────────────────

create table if not exists run_events (
  id bigserial primary key,
  generation_id uuid not null references generations(id) on delete cascade,
  chapter_idx int,
  stage text not null,
  provider text,
  kind text not null,
  attempt int,
  duration_ms int,
  payload jsonb,
  response jsonb,
  error jsonb,
  created_at timestamptz not null default now()
);

alter table run_events enable row level security;

drop policy if exists "run_events: owner read via generations" on run_events;
create policy "run_events: owner read via generations"
  on run_events for select
  using (
    exists (
      select 1 from generations
      where generations.id = run_events.generation_id
        and generations.user_id = auth.uid()
    )
  );

create index if not exists run_events_gen_idx on run_events(generation_id, created_at);
create index if not exists run_events_errors_idx on run_events(generation_id) where kind = 'error';

-- ─── Feedback ────────────────────────────────────────────────────────────────

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  rating smallint not null check (rating in (-1, 1)),
  note text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

drop policy if exists "feedback: owner read" on feedback;
create policy "feedback: owner read"
  on feedback for select
  using (
    exists (
      select 1 from generations
      where generations.id = feedback.generation_id
        and generations.user_id = auth.uid()
    )
  );

drop policy if exists "feedback: authenticated insert" on feedback;
create policy "feedback: authenticated insert"
  on feedback for insert
  with check (auth.uid() is not null or user_id is null);

create index if not exists feedback_generation_idx on feedback(generation_id, created_at desc);

-- ─── Share Links ─────────────────────────────────────────────────────────────

create table if not exists share_links (
  token text primary key,
  generation_id uuid not null references generations(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table share_links enable row level security;

drop policy if exists "share_links: owner read/write" on share_links;
create policy "share_links: owner read/write"
  on share_links for all
  using (
    exists (
      select 1 from generations
      where generations.id = share_links.generation_id
        and generations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from generations
      where generations.id = share_links.generation_id
        and generations.user_id = auth.uid()
    )
  );

create index if not exists share_links_generation_idx on share_links(generation_id);

-- ─── User Documents ──────────────────────────────────────────────────────────

create table if not exists user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('url','pdf')),
  source_url text,
  storage_path text,
  title text,
  extracted_text text,
  bytes int,
  created_at timestamptz not null default now()
);

alter table user_documents enable row level security;

drop policy if exists "user_documents: owner read/write" on user_documents;
create policy "user_documents: owner read/write"
  on user_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_documents_user_idx on user_documents(user_id, created_at desc);

-- ─── Storage ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio', 'audio', true, 524288000, array['audio/mpeg']),
  ('tts-chunks', 'tts-chunks', false, 524288000, array['audio/mpeg']),
  ('user-docs', 'user-docs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "audio: owner delete" on storage.objects;
create policy "audio: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-docs: owner read/write" on storage.objects;
create policy "user-docs: owner read/write"
  on storage.objects for all
  using (
    bucket_id = 'user-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function merge_stage_progress(
  gen_id uuid,
  progress_key text,
  done_val int,
  total_val int
)
returns void
language sql
security definer
set search_path = public
as $$
  update generations
  set stage_progress = coalesce(stage_progress, '{}'::jsonb)
    || jsonb_build_object(progress_key, jsonb_build_object('done', done_val, 'total', total_val))
  where id = gen_id;
$$;

-- ─── Orphan sweeper (pg_cron) ────────────────────────────────────────────────
-- Marks generations stuck in a non-terminal state for >60 min as failed.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep-orphaned-generations') then
    perform cron.unschedule('sweep-orphaned-generations');
  end if;

  perform cron.schedule(
    'sweep-orphaned-generations',
    '*/15 * * * *',
    $job$
      update generations
      set status = 'failed',
          error = jsonb_build_object('code','timeout','message','No progress for over 60 minutes')
      where status in ('queued','outlining','researching','drafting','aggregating','synthesizing')
        and created_at < now() - interval '60 minutes';
    $job$
  );
end $$;
