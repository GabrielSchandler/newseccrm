create table if not exists public.legal_payment_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  slug text not null,
  description text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint legal_payment_types_name_not_blank check (length(trim(name)) > 0),
  constraint legal_payment_types_slug_not_blank check (length(trim(slug)) > 0)
);

create unique index if not exists legal_payment_types_company_slug_idx
  on public.legal_payment_types (company_id, lower(trim(slug)));

create unique index if not exists legal_payment_types_company_name_idx
  on public.legal_payment_types (company_id, lower(trim(name)));

create index if not exists legal_payment_types_company_active_idx
  on public.legal_payment_types (company_id, is_active, sort_order);

create table if not exists public.legal_commission_tiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  min_goal_amount numeric(14,2) not null default 0,
  commission_percent numeric(6,3) not null default 0,
  label text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  constraint legal_commission_tiers_min_positive check (min_goal_amount >= 0),
  constraint legal_commission_tiers_percent_range check (
    commission_percent >= 0 and commission_percent <= 100
  )
);

create unique index if not exists legal_commission_tiers_company_min_idx
  on public.legal_commission_tiers (company_id, min_goal_amount);

create index if not exists legal_commission_tiers_company_active_idx
  on public.legal_commission_tiers (company_id, is_active, min_goal_amount desc);

create table if not exists public.legal_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pre_sale_id uuid not null references public.pre_sales(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  legal_payment_type_id uuid not null references public.legal_payment_types(id) on delete restrict,
  responsible_user_id uuid null references public.user_profiles(id) on delete set null,
  installment_number integer not null default 1,
  description text null,
  amount numeric(14,2) not null default 0,
  goal_amount numeric(14,2) not null default 0,
  payment_method text null,
  due_date date null,
  paid_at date null,
  status text not null default 'previsto'
    check (status in ('previsto', 'pago', 'vencido', 'cancelado')),
  finance_transaction_id uuid null references public.finance_transactions(id) on delete set null,
  finance_sale_id uuid null references public.finance_sales(id) on delete set null,
  receipt_generated_document_id uuid null references public.generated_documents(id) on delete set null,
  notes text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint legal_payments_installment_positive check (installment_number > 0),
  constraint legal_payments_amount_positive check (amount >= 0),
  constraint legal_payments_goal_amount_positive check (goal_amount >= 0)
);

create index if not exists legal_payments_company_pre_sale_idx
  on public.legal_payments (company_id, pre_sale_id, created_at desc);

create index if not exists legal_payments_company_client_idx
  on public.legal_payments (company_id, client_id, created_at desc);

create index if not exists legal_payments_company_status_idx
  on public.legal_payments (company_id, status, due_date);

create index if not exists legal_payments_company_responsible_idx
  on public.legal_payments (company_id, responsible_user_id, paid_at desc);

insert into public.legal_payment_types (company_id, name, slug, sort_order)
select companies.id, seed.name, seed.slug, seed.sort_order
from public.companies
cross join (
  values
    ('Laudo', 'laudo', 10),
    ('Diligencia', 'diligencia', 20),
    ('Certidao', 'certidao', 30),
    ('Honorarios', 'honorarios', 40),
    ('Acordo', 'acordo', 50),
    ('Taxa processual', 'taxa_processual', 60),
    ('Outros', 'outros', 70)
) as seed(name, slug, sort_order)
on conflict do nothing;

insert into public.finance_categories (company_id, name, kind)
select companies.id, 'Receita Juridica', 'income'
from public.companies
on conflict do nothing;

do $$
declare
  constraint_record record;
begin
  if to_regclass('public.finance_transactions') is not null then
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.finance_transactions'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%source%'
    loop
      execute format(
        'alter table public.finance_transactions drop constraint %I',
        constraint_record.conname
      );
    end loop;

    alter table public.finance_transactions
      add constraint finance_transactions_source_check
      check (source in ('manual', 'excel_import', 'pre_sale', 'legal_payment', 'adjustment'));
  end if;

  if to_regclass('public.finance_sales') is not null then
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.finance_sales'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%source%'
    loop
      execute format(
        'alter table public.finance_sales drop constraint %I',
        constraint_record.conname
      );
    end loop;

    alter table public.finance_sales
      add constraint finance_sales_source_check
      check (source in ('manual', 'excel_import', 'pre_sale', 'legal_payment'));
  end if;
end $$;

alter table public.generated_documents
  add column if not exists legal_payment_id uuid null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select constraint_name
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'legal_payments'
      and column_name = 'id'
      and constraint_name in (
        select constraint_name
        from information_schema.key_column_usage
        where table_schema = 'public'
          and table_name = 'generated_documents'
          and column_name = 'legal_payment_id'
      )
  loop
    execute format(
      'alter table public.generated_documents drop constraint if exists %I',
      constraint_record.constraint_name
    );
  end loop;
end $$;

create index if not exists generated_documents_company_legal_payment_idx
  on public.generated_documents (company_id, legal_payment_id)
  where legal_payment_id is not null;

alter table public.legal_payment_types enable row level security;
alter table public.legal_commission_tiers enable row level security;
alter table public.legal_payments enable row level security;

drop policy if exists legal_payment_types_select_own_company
  on public.legal_payment_types;
create policy legal_payment_types_select_own_company
  on public.legal_payment_types
  for select
  to authenticated
  using (company_id = public.current_user_company_id());

drop policy if exists legal_payment_types_manage_admin_manager
  on public.legal_payment_types;
create policy legal_payment_types_manage_admin_manager
  on public.legal_payment_types
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

drop policy if exists legal_commission_tiers_select_own_company
  on public.legal_commission_tiers;
create policy legal_commission_tiers_select_own_company
  on public.legal_commission_tiers
  for select
  to authenticated
  using (company_id = public.current_user_company_id());

drop policy if exists legal_commission_tiers_manage_admin_manager
  on public.legal_commission_tiers;
create policy legal_commission_tiers_manage_admin_manager
  on public.legal_commission_tiers
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

drop policy if exists legal_payments_manage_own_company_legal
  on public.legal_payments;
create policy legal_payments_manage_own_company_legal
  on public.legal_payments
  for all
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_payments.company_id
        and profile.is_active = true
        and (
          profile.role in ('admin', 'manager')
          or profile.business_area = 'legal'
        )
    )
  )
  with check (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_payments.company_id
        and profile.is_active = true
        and (
          profile.role in ('admin', 'manager')
          or profile.business_area = 'legal'
        )
    )
  );

grant select, insert, update, delete on public.legal_payment_types to authenticated;
grant select, insert, update, delete on public.legal_commission_tiers to authenticated;
grant select, insert, update, delete on public.legal_payments to authenticated;
