-- Modulo de leads importados de Google Sheets.
-- Rode no SQL Editor do Supabase antes de usar a tela de Fontes/Distribuicao de leads.

begin;

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sheet_url text not null,
  sheet_gid text null,
  start_row integer not null default 2 check (start_row >= 1),
  name_column text not null default 'A',
  phone_column text null default 'B',
  email_column text null,
  cpf_column text null,
  campaign_column text null,
  notes_column text null,
  is_active boolean not null default true,
  last_checked_at timestamptz null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid null references public.lead_sources(id) on delete set null,
  source_row_key text null,
  source_row_number integer null,
  full_name text not null,
  phone text null,
  email text null,
  cpf text null,
  campaign text null,
  notes text null,
  status text not null default 'novo'
    check (status in ('novo', 'distribuido', 'convertido', 'descartado')),
  assigned_to uuid null references public.user_profiles(id) on delete set null,
  assigned_by uuid null references public.user_profiles(id) on delete set null,
  assigned_at timestamptz null,
  imported_at timestamptz not null default now(),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, source_id, source_row_key)
);

create index if not exists lead_sources_company_idx
  on public.lead_sources(company_id);

create index if not exists leads_company_status_idx
  on public.leads(company_id, status, created_at desc);

create index if not exists leads_company_assigned_idx
  on public.leads(company_id, assigned_to, status);

create index if not exists leads_company_phone_idx
  on public.leads(company_id, phone)
  where phone is not null;

create index if not exists leads_company_cpf_idx
  on public.leads(company_id, cpf)
  where cpf is not null;

alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;

drop policy if exists lead_sources_select_own_company on public.lead_sources;
create policy lead_sources_select_own_company
  on public.lead_sources
  for select
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_active()
  );

drop policy if exists lead_sources_manage_admin_manager on public.lead_sources;
create policy lead_sources_manage_admin_manager
  on public.lead_sources
  for all
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin_or_manager()
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin_or_manager()
  );

drop policy if exists leads_select_own_scope on public.leads;
create policy leads_select_own_scope
  on public.leads
  for select
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_active()
    and (
      public.current_user_is_admin_or_manager()
      or assigned_to = public.current_user_profile_id()
    )
  );

drop policy if exists leads_manage_admin_manager on public.leads;
create policy leads_manage_admin_manager
  on public.leads
  for all
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin_or_manager()
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin_or_manager()
  );

commit;
