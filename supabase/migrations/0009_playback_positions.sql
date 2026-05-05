-- Per-user playback resume state for signed-in listeners.

create table if not exists generation_playback_positions (
  user_id uuid not null references profiles(id) on delete cascade,
  generation_id uuid not null references generations(id) on delete cascade,
  position_seconds int not null default 0 check (position_seconds >= 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

alter table generation_playback_positions enable row level security;

create index if not exists generation_playback_positions_generation_idx
  on generation_playback_positions(generation_id, updated_at desc);

drop policy if exists "playback_positions: user read accessible" on generation_playback_positions;
create policy "playback_positions: user read accessible"
  on generation_playback_positions for select
  using (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = generation_playback_positions.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = generation_playback_positions.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  );

drop policy if exists "playback_positions: user insert accessible" on generation_playback_positions;
create policy "playback_positions: user insert accessible"
  on generation_playback_positions for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = generation_playback_positions.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = generation_playback_positions.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  );

drop policy if exists "playback_positions: user update accessible" on generation_playback_positions;
create policy "playback_positions: user update accessible"
  on generation_playback_positions for update
  using (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = generation_playback_positions.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = generation_playback_positions.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  )
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = generation_playback_positions.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = generation_playback_positions.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  );
