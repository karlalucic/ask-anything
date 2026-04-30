-- Track generation activity separately from created_at so long, active runs
-- are not swept as orphaned just because they take more than an hour.

alter table generations
  add column if not exists last_progress_at timestamptz not null default now();

create or replace function public.touch_generation_progress_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.last_progress_at = now();
  return new;
end;
$$;

drop trigger if exists touch_generation_progress_at on generations;
create trigger touch_generation_progress_at
  before update on generations
  for each row execute function public.touch_generation_progress_at();

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
          error = jsonb_build_object('code','timeout','message','No progress for over 4 hours')
      where status in ('queued','outlining','researching','drafting','aggregating','synthesizing')
        and last_progress_at < now() - interval '4 hours';
    $job$
  );
end $$;
