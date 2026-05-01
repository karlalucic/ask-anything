-- Hash share_links.token at rest the same way share_invites.token_hash does.
--
-- Background: share_invites stores SHA-256(token), share_links stored the
-- plaintext token. Anyone with read access to share_links (DB backup, future
-- RLS bug, leaky select) could replay /s/<token>. This migration moves
-- share_links onto the same hashed-at-rest model, returning the plaintext
-- token to the client only at creation time.
--
-- Existing share links keep working because the URL is the plaintext token;
-- we just look it up by SHA-256 instead of by literal string match.

create extension if not exists pgcrypto;

alter table share_links
  add column if not exists token_hash text;

update share_links
   set token_hash = encode(digest(token, 'sha256'), 'hex')
 where token_hash is null;

alter table share_links
  alter column token_hash set not null;

create unique index if not exists share_links_token_hash_idx
  on share_links(token_hash);

-- Drop the plaintext primary key so we can drop the column.
alter table share_links drop constraint if exists share_links_pkey;
alter table share_links drop column if exists token;

-- Re-establish a primary key on the hash so PostgREST is happy and we keep
-- the implicit not-null/unique guarantees rolled into one constraint.
alter table share_links add primary key (token_hash);
