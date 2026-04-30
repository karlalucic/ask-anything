-- ─── profiles.has_seen_intro ──────────────────────────────────────────────────
-- Tracks whether the user has dismissed (or completed) the first-time
-- guided intro modal that appears on the logged-in home page. Default false
-- so brand-new accounts see it. Backfilled to true for any user who has
-- already generated something — they've clearly used the app and don't
-- need to be onboarded.

alter table profiles
  add column if not exists has_seen_intro boolean not null default false;

update profiles
  set has_seen_intro = true
  where id in (select distinct user_id from generations);
