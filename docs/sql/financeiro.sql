-- Modulo financeiro do CRM.
-- Execute este arquivo completo no SQL Editor do Supabase antes de usar a tela Financeiro.

begin;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select up.is_active and up.role = 'admin'
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  kind text not null default 'both'
    check (kind in ('income', 'expense', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint finance_categories_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists finance_categories_company_name_idx
  on public.finance_categories (company_id, lower(trim(name)));

create index if not exists finance_categories_company_kind_idx
  on public.finance_categories (company_id, kind, is_active);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  account_type text not null default 'bank'
    check (account_type in ('bank', 'cash', 'platform', 'card', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint finance_accounts_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists finance_accounts_company_name_idx
  on public.finance_accounts (company_id, lower(trim(name)));

create index if not exists finance_accounts_company_type_idx
  on public.finance_accounts (company_id, account_type, is_active);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  direction text not null check (direction in ('income', 'expense')),
  status text not null default 'planned'
    check (status in ('planned', 'paid', 'overdue', 'canceled')),
  due_date date not null,
  paid_at date null,
  description text not null,
  counterparty text null,
  category_id uuid null references public.finance_categories(id) on delete set null,
  account_id uuid null references public.finance_accounts(id) on delete set null,
  amount_expected numeric(14,2) not null default 0,
  amount_paid numeric(14,2) null,
  payment_method text null,
  source text not null default 'manual'
    check (source in ('manual', 'excel_import', 'pre_sale', 'adjustment')),
  source_hash text null,
  notes text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint finance_transactions_description_not_blank check (length(trim(description)) > 0),
  constraint finance_transactions_amount_expected_positive check (amount_expected >= 0),
  constraint finance_transactions_amount_paid_positive check (amount_paid is null or amount_paid >= 0)
);

create unique index if not exists finance_transactions_company_source_hash_idx
  on public.finance_transactions (company_id, source_hash);

create index if not exists finance_transactions_company_due_idx
  on public.finance_transactions (company_id, due_date desc);

create index if not exists finance_transactions_company_status_idx
  on public.finance_transactions (company_id, status, direction);

create table if not exists public.finance_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_date date not null,
  client_name text not null,
  client_cpf text null,
  consultant_user_id uuid null references public.user_profiles(id) on delete set null,
  consultant_name text null,
  modality text null,
  platform text null,
  installment_count text null,
  gross_amount numeric(14,2) not null default 0,
  goal_amount numeric(14,2) not null default 0,
  debtor_amount numeric(14,2) null,
  award_amount numeric(14,2) null,
  report_amount numeric(14,2) null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'canceled')),
  source text not null default 'manual'
    check (source in ('manual', 'excel_import', 'pre_sale')),
  source_hash text null,
  notes text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint finance_sales_client_name_not_blank check (length(trim(client_name)) > 0),
  constraint finance_sales_gross_amount_positive check (gross_amount >= 0),
  constraint finance_sales_goal_amount_positive check (goal_amount >= 0)
);

create unique index if not exists finance_sales_company_source_hash_idx
  on public.finance_sales (company_id, source_hash);

create index if not exists finance_sales_company_sale_date_idx
  on public.finance_sales (company_id, sale_date desc);

create index if not exists finance_sales_company_consultant_idx
  on public.finance_sales (company_id, consultant_user_id, sale_date desc);

create index if not exists finance_sales_company_cpf_idx
  on public.finance_sales (company_id, client_cpf);

create table if not exists public.finance_chargebacks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chargeback_date date not null,
  client_name text not null,
  client_cpf text null,
  amount numeric(14,2) not null default 0,
  charged_at date null,
  status text not null default 'pending'
    check (status in ('pending', 'charged', 'lost', 'canceled')),
  source text not null default 'manual'
    check (source in ('manual', 'excel_import')),
  source_hash text null,
  notes text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint finance_chargebacks_client_name_not_blank check (length(trim(client_name)) > 0),
  constraint finance_chargebacks_amount_positive check (amount >= 0)
);

create unique index if not exists finance_chargebacks_company_source_hash_idx
  on public.finance_chargebacks (company_id, source_hash);

create index if not exists finance_chargebacks_company_date_idx
  on public.finance_chargebacks (company_id, chargeback_date desc);

create table if not exists public.finance_import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  file_name text not null,
  file_size_bytes bigint null,
  imported_by uuid null references public.user_profiles(id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'partial', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists finance_import_batches_company_created_idx
  on public.finance_import_batches (company_id, created_at desc);

create table if not exists public.finance_import_rows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  batch_id uuid not null references public.finance_import_batches(id) on delete cascade,
  row_type text not null
    check (row_type in ('transaction', 'sale', 'chargeback', 'ignored', 'error')),
  sheet_name text null,
  row_number integer null,
  raw_data jsonb not null default '{}'::jsonb,
  imported_entity_type text null,
  imported_entity_id uuid null,
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists finance_import_rows_batch_idx
  on public.finance_import_rows (company_id, batch_id, row_type);

insert into public.finance_categories (company_id, name, kind)
select companies.id, seed.name, seed.kind
from public.companies
cross join (
  values
    ('Vendas', 'income'),
    ('Consultoria', 'income'),
    ('Restituicao', 'income'),
    ('Leads', 'expense'),
    ('Salarios', 'expense'),
    ('Beneficios', 'expense'),
    ('Premiacao', 'expense'),
    ('Marketing', 'expense'),
    ('Sistemas', 'expense'),
    ('Juridico', 'expense'),
    ('Laudos', 'expense'),
    ('Impostos', 'expense'),
    ('Aluguel', 'expense'),
    ('Chargeback', 'expense'),
    ('Outros', 'both')
) as seed(name, kind)
on conflict do nothing;

insert into public.finance_accounts (company_id, name, account_type)
select companies.id, seed.name, seed.account_type
from public.companies
cross join (
  values
    ('Inter', 'bank'),
    ('Nubank', 'bank'),
    ('PayUp', 'platform'),
    ('Cartao', 'card'),
    ('Dinheiro', 'cash'),
    ('Outros', 'other')
) as seed(name, account_type)
on conflict do nothing;

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_sales enable row level security;
alter table public.finance_chargebacks enable row level security;
alter table public.finance_import_batches enable row level security;
alter table public.finance_import_rows enable row level security;

do $$
declare
  target_table text;
  qualified_table text;
begin
  foreach target_table in array array[
    'finance_categories',
    'finance_accounts',
    'finance_transactions',
    'finance_sales',
    'finance_chargebacks',
    'finance_import_batches',
    'finance_import_rows'
  ]
  loop
    qualified_table := format('public.%I', target_table);

    execute format('drop policy if exists %I on %s', target_table || '_select_admin', qualified_table);
    execute format(
      'create policy %I on %s for select to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin())',
      target_table || '_select_admin',
      qualified_table
    );

    execute format('drop policy if exists %I on %s', target_table || '_insert_admin', qualified_table);
    execute format(
      'create policy %I on %s for insert to authenticated with check (company_id = public.current_user_company_id() and public.current_user_is_admin())',
      target_table || '_insert_admin',
      qualified_table
    );

    execute format('drop policy if exists %I on %s', target_table || '_update_admin', qualified_table);
    execute format(
      'create policy %I on %s for update to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin()) with check (company_id = public.current_user_company_id() and public.current_user_is_admin())',
      target_table || '_update_admin',
      qualified_table
    );

    execute format('drop policy if exists %I on %s', target_table || '_delete_admin', qualified_table);
    execute format(
      'create policy %I on %s for delete to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin())',
      target_table || '_delete_admin',
      qualified_table
    );
  end loop;
end $$;

grant select, insert, update, delete on public.finance_categories to authenticated;
grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_transactions to authenticated;
grant select, insert, update, delete on public.finance_sales to authenticated;
grant select, insert, update, delete on public.finance_chargebacks to authenticated;
grant select, insert, update, delete on public.finance_import_batches to authenticated;
grant select, insert, update, delete on public.finance_import_rows to authenticated;

commit;
