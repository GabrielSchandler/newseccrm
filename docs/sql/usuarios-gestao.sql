-- Execute manualmente no Supabase antes de usar a gestao de usuarios.
-- Mantem company_id, nao altera o login existente nem o Supabase Auth configurado.

alter table public.user_profiles
  add column if not exists phone text,
  add column if not exists is_active boolean not null default true,
  add column if not exists invited_by uuid,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists updated_at timestamptz;

alter table public.companies
  add column if not exists user_license_limit integer not null default 1;
