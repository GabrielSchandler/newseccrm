alter table public.user_profiles
  add column if not exists password_must_change boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists password_reset_at timestamptz,
  add column if not exists password_reset_by uuid null references public.user_profiles(id) on delete set null;

create index if not exists user_profiles_password_must_change_idx
  on public.user_profiles (company_id, password_must_change)
  where password_must_change = true;
