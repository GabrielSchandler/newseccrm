alter table public.user_profiles
  add column if not exists monthly_goal numeric(12, 2);
