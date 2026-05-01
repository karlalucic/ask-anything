-- Let any authenticated user read a public, completed generation (and its
-- chapters). Pre-this, "public" only granted access via the service-role
-- /s/<token> page; the user-scoped RLS path was owner-or-shared-only, so
-- a non-owner who happened to know /listen/<uuid> got a 404 even when the
-- generation was deliberately public.
--
-- Pairing this with the product change to require login on /s as well,
-- "public" now means "any logged-in user with the link." Anonymous reads
-- still go nowhere — `auth.uid() is not null` keeps them out.

create policy "generations: authed read public complete"
  on generations for select
  using (
    visibility = 'public'
    and status = 'complete'
    and auth.uid() is not null
  );

create policy "chapters: authed read public complete"
  on chapters for select
  using (
    exists (
      select 1 from generations
      where generations.id = chapters.generation_id
        and generations.visibility = 'public'
        and generations.status = 'complete'
        and auth.uid() is not null
    )
  );
