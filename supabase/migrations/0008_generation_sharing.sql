-- Account-level sharing and explicit public visibility.

do $$
begin
  create type generation_visibility as enum ('private', 'public');
exception when duplicate_object then null;
end $$;

alter table generations
  add column if not exists visibility generation_visibility not null default 'private';

-- Existing active share_links were already public listener links. Preserve that
-- behavior for completed generations so deployed links do not silently break.
update generations
set visibility = 'public'
where status = 'complete'
  and exists (
    select 1
    from share_links
    where share_links.generation_id = generations.id
      and share_links.revoked_at is null
  );

-- Enforce at most one active public token per generation. If historical data has
-- duplicates, keep the most recently created token active and revoke the rest.
with ranked as (
  select
    token,
    row_number() over (
      partition by generation_id
      order by created_at desc, token desc
    ) as rn
  from share_links
  where revoked_at is null
)
update share_links
set revoked_at = now()
from ranked
where share_links.token = ranked.token
  and ranked.rn > 1;

create unique index if not exists share_links_one_active_per_generation_idx
  on share_links(generation_id)
  where revoked_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generations_id_user_id_key'
  ) then
    alter table generations
      add constraint generations_id_user_id_key unique (id, user_id);
  end if;
end $$;

create table if not exists generation_shares (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  shared_with uuid not null references profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint generation_shares_generation_owner_fk
    foreign key (generation_id, owner_id)
    references generations(id, user_id)
    on delete cascade,
  constraint generation_shares_not_self check (owner_id <> shared_with)
);

alter table generation_shares enable row level security;

create index if not exists generation_shares_owner_idx
  on generation_shares(owner_id, created_at desc);
create index if not exists generation_shares_recipient_idx
  on generation_shares(shared_with, created_at desc)
  where revoked_at is null;
create index if not exists generation_shares_generation_idx
  on generation_shares(generation_id, created_at desc);
create unique index if not exists generation_shares_one_active_recipient_idx
  on generation_shares(generation_id, shared_with)
  where revoked_at is null;

drop policy if exists "generation_shares: owner manage" on generation_shares;
create policy "generation_shares: owner manage"
  on generation_shares for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "generation_shares: recipient read active" on generation_shares;
create policy "generation_shares: recipient read active"
  on generation_shares for select
  using (shared_with = auth.uid() and revoked_at is null);

create table if not exists share_invites (
  token_hash text primary key,
  generation_id uuid not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_by uuid references profiles(id) on delete set null,
  claimed_at timestamptz,
  revoked_at timestamptz,
  constraint share_invites_generation_owner_fk
    foreign key (generation_id, created_by)
    references generations(id, user_id)
    on delete cascade
);

alter table share_invites enable row level security;

create index if not exists share_invites_generation_idx
  on share_invites(generation_id, created_at desc);
create index if not exists share_invites_created_by_idx
  on share_invites(created_by, created_at desc);
create index if not exists share_invites_claimed_by_idx
  on share_invites(claimed_by, claimed_at desc)
  where claimed_by is not null;

drop policy if exists "share_invites: owner manage" on share_invites;
create policy "share_invites: owner manage"
  on share_invites for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "generations: shared read" on generations;
create policy "generations: shared read"
  on generations for select
  using (
    status = 'complete'
    and exists (
      select 1
      from generation_shares
      where generation_shares.generation_id = generations.id
        and generation_shares.shared_with = auth.uid()
        and generation_shares.revoked_at is null
    )
  );

drop policy if exists "chapters: shared read via generation_shares" on chapters;
create policy "chapters: shared read via generation_shares"
  on chapters for select
  using (
    exists (
      select 1
      from generation_shares
      join generations on generations.id = generation_shares.generation_id
      where generation_shares.generation_id = chapters.generation_id
        and generation_shares.shared_with = auth.uid()
        and generation_shares.revoked_at is null
        and generations.status = 'complete'
    )
  );
