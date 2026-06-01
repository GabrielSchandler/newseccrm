-- Execute manualmente no Supabase antes de usar a gestao de usuarios.
-- Mantem company_id, nao altera o login existente nem o Supabase Auth configurado.

alter table public.user_profiles
  add column if not exists phone text,
  add column if not exists is_active boolean not null default true,
  add column if not exists password_must_change boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists password_reset_at timestamptz,
  add column if not exists password_reset_by uuid null references public.user_profiles(id) on delete set null,
  add column if not exists invited_by uuid,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists updated_at timestamptz;

create index if not exists user_profiles_password_must_change_idx
  on public.user_profiles (company_id, password_must_change)
  where password_must_change = true;

alter table public.companies
  add column if not exists user_license_limit integer not null default 1;
