alter table public.pre_sale_financial_cases
  add column if not exists financer_legal_name text,
  add column if not exists financer_cnpj text,
  add column if not exists financer_address text,
  add column if not exists financer_district text,
  add column if not exists financer_zip_code text,
  add column if not exists financer_city text,
  add column if not exists financer_state text;

alter table public.pre_sales
  add column if not exists legal_department text,
  add column if not exists legal_status_text text,
  add column if not exists legal_document_status text,
  add column if not exists legal_case_number text,
  add column if not exists legal_case_year text,
  add column if not exists legal_deadline text,
  add column if not exists legal_county text,
  add column if not exists legal_forum text,
  add column if not exists legal_court_division text,
  add column if not exists legal_operator_name text,
  add column if not exists legal_process_operator_name text,
  add column if not exists legal_protocol text,
  add column if not exists legacy_source text,
  add column if not exists legacy_external_id text;

create unique index if not exists pre_sales_legacy_source_external_id_idx
  on public.pre_sales(company_id, legacy_source, legacy_external_id)
  where legacy_source is not null
    and legacy_external_id is not null;

create table if not exists public.legacy_rd_import (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_row_number integer not null,
  legacy_external_id text null,
  source_file_name text not null default 'Tab_Clientes.xlsx',
  source_sheet_name text not null default 'Tab_Clientes',
  payload jsonb not null default '{}'::jsonb,
  import_status text not null default 'pending',
  error_message text null,
  imported_client_id uuid null references public.clients(id) on delete set null,
  imported_pre_sale_id uuid null references public.pre_sales(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create unique index if not exists legacy_rd_import_company_external_id_idx
  on public.legacy_rd_import(company_id, legacy_external_id)
  where legacy_external_id is not null;

create index if not exists legacy_rd_import_company_status_idx
  on public.legacy_rd_import(company_id, import_status, created_at desc);

alter table public.legacy_rd_import enable row level security;

drop policy if exists legacy_rd_import_select_admin_manager on public.legacy_rd_import;
create policy legacy_rd_import_select_admin_manager
on public.legacy_rd_import
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = legacy_rd_import.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
);

drop policy if exists legacy_rd_import_insert_admin_manager on public.legacy_rd_import;
create policy legacy_rd_import_insert_admin_manager
on public.legacy_rd_import
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = legacy_rd_import.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
);

drop policy if exists legacy_rd_import_update_admin_manager on public.legacy_rd_import;
create policy legacy_rd_import_update_admin_manager
on public.legacy_rd_import
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = legacy_rd_import.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = legacy_rd_import.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
);
