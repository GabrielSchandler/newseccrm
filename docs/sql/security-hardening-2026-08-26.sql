-- Security hardening: remove recoverable passwords and protect the public
-- contract-tracking lookup against automated enumeration.
-- Run this file in the Supabase SQL Editor after deploying the application.

begin;

-- Passwords must only exist inside Supabase Auth as non-recoverable hashes.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'last_set_password'
  ) then
    execute 'update public.user_profiles set last_set_password = null where last_set_password is not null';
  end if;
end;
$$;

alter table public.user_profiles
  drop column if exists last_set_password;

create table if not exists public.public_tracking_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

alter table public.public_tracking_rate_limits enable row level security;

revoke all on table public.public_tracking_rate_limits from public, anon, authenticated;

create index if not exists public_tracking_rate_limits_updated_at_idx
  on public.public_tracking_rate_limits (updated_at);

create or replace function public.consume_public_tracking_rate_limit(
  p_key_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_attempts integer;
  window_interval interval;
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'invalid rate-limit key';
  end if;

  if p_max_attempts < 1 or p_max_attempts > 1000 then
    raise exception 'invalid maximum attempts';
  end if;

  if p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into public.public_tracking_rate_limits as rate_limit (
    key_hash,
    window_started_at,
    attempts,
    updated_at
  )
  values (p_key_hash, now(), 1, now())
  on conflict (key_hash) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= now() - window_interval then now()
      else rate_limit.window_started_at
    end,
    attempts = case
      when rate_limit.window_started_at <= now() - window_interval then 1
      else rate_limit.attempts + 1
    end,
    updated_at = now()
  returning attempts into current_attempts;

  return current_attempts <= p_max_attempts;
end;
$$;

revoke all on function public.consume_public_tracking_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_tracking_rate_limit(text, integer, integer)
  to service_role;

commit;

-- Optional operational cleanup (safe to run periodically):
-- delete from public.public_tracking_rate_limits
-- where updated_at < now() - interval '2 days';

-- Structural rollback, if ever needed. The password column is deliberately not restored:
-- drop function if exists public.consume_public_tracking_rate_limit(text, integer, integer);
-- drop table if exists public.public_tracking_rate_limits;
