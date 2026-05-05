-- Per-user library hiding. This does not delete generations, audio, scripts, or
-- share access; it only removes an item from the current user's library views.

create table if not exists library_hidden_items (
  user_id uuid not null references profiles(id) on delete cascade,
  generation_id uuid not null references generations(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

alter table library_hidden_items enable row level security;

create index if not exists library_hidden_items_user_hidden_idx
  on library_hidden_items(user_id, hidden_at desc);

create index if not exists library_hidden_items_generation_idx
  on library_hidden_items(generation_id);

drop policy if exists "library_hidden_items: user read own" on library_hidden_items;
create policy "library_hidden_items: user read own"
  on library_hidden_items for select
  using (user_id = auth.uid());

drop policy if exists "library_hidden_items: user insert accessible" on library_hidden_items;
create policy "library_hidden_items: user insert accessible"
  on library_hidden_items for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = library_hidden_items.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = library_hidden_items.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  );

drop policy if exists "library_hidden_items: user update own" on library_hidden_items;
create policy "library_hidden_items: user update own"
  on library_hidden_items for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from generations
        where generations.id = library_hidden_items.generation_id
          and generations.user_id = auth.uid()
      )
      or exists (
        select 1
        from generation_shares
        where generation_shares.generation_id = library_hidden_items.generation_id
          and generation_shares.shared_with = auth.uid()
          and generation_shares.revoked_at is null
      )
    )
  );

drop policy if exists "library_hidden_items: user delete own" on library_hidden_items;
create policy "library_hidden_items: user delete own"
  on library_hidden_items for delete
  using (user_id = auth.uid());
