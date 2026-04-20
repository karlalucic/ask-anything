-- Repair the auth user trigger used by Supabase Auth.
-- Without schema qualification and a fixed search_path, the trigger can fail
-- during OAuth/email sign-up with "Database error saving new user".

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

insert into public.profiles (id, email, display_name)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data->>'full_name',
    users.raw_user_meta_data->>'name',
    users.email
  )
from auth.users
left join public.profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;
