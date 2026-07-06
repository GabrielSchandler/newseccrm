-- Configuracoes comerciais da plataforma por empresa.
-- Execute no SQL Editor do Supabase depois do deploy.

begin;

create table if not exists public.company_platform_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'trial', 'suspended', 'cancelled')),
  storage_limit_mb integer not null default 10240
    check (storage_limit_mb >= 100 and storage_limit_mb <= 1048576),
  enable_commercial boolean not null default true,
  enable_legal boolean not null default true,
  enable_finance boolean not null default true,
  enable_academy boolean not null default true,
  enable_lead_distribution boolean not null default true,
  enable_client_portal boolean not null default true,
  enable_backups boolean not null default true,
  enable_outlook_email boolean not null default true,
  enable_simulations boolean not null default true,
  enable_documents boolean not null default true,
  enable_custom_templates boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  updated_by uuid null references public.user_profiles(id) on delete set null
);

create index if not exists company_platform_settings_status_idx
  on public.company_platform_settings(status);

alter table public.company_platform_settings enable row level security;

drop policy if exists company_platform_settings_select_visible on public.company_platform_settings;
create policy company_platform_settings_select_visible
on public.company_platform_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.is_active = true
      and (
        up.company_id = company_platform_settings.company_id
        or up.is_platform_owner = true
      )
  )
);

drop policy if exists company_platform_settings_insert_platform_owner on public.company_platform_settings;
create policy company_platform_settings_insert_platform_owner
on public.company_platform_settings
for insert
to authenticated
with check (public.current_user_is_platform_owner());

drop policy if exists company_platform_settings_update_platform_owner on public.company_platform_settings;
create policy company_platform_settings_update_platform_owner
on public.company_platform_settings
for update
to authenticated
using (public.current_user_is_platform_owner())
with check (public.current_user_is_platform_owner());

drop policy if exists company_platform_settings_delete_platform_owner on public.company_platform_settings;
create policy company_platform_settings_delete_platform_owner
on public.company_platform_settings
for delete
to authenticated
using (public.current_user_is_platform_owner());

insert into public.company_platform_settings (company_id)
select c.id
from public.companies c
on conflict (company_id) do nothing;

commit;
