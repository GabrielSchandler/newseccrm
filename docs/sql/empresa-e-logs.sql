alter table public.companies
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists logo_path text,
  add column if not exists logo_file_name text;

create table if not exists public.company_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid null references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  entity_label text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_audit_logs_company_created_at_idx
  on public.company_audit_logs(company_id, created_at desc);

create index if not exists company_audit_logs_user_profile_id_idx
  on public.company_audit_logs(user_profile_id);

alter table public.company_audit_logs enable row level security;

drop policy if exists company_audit_logs_select_admin on public.company_audit_logs;
create policy company_audit_logs_select_admin
on public.company_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = company_audit_logs.company_id
      and up.is_active = true
      and up.role = 'admin'
  )
);

drop policy if exists company_audit_logs_insert_own_company on public.company_audit_logs;
create policy company_audit_logs_insert_own_company
on public.company_audit_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = company_audit_logs.company_id
      and up.is_active = true
  )
);

drop policy if exists companies_update_admin_only on public.companies;
create policy companies_update_admin_only
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = companies.id
      and up.is_active = true
      and up.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = companies.id
      and up.is_active = true
      and up.role = 'admin'
  )
);
