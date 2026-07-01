alter table public.pre_sales
  add column if not exists tracking_protocol text;

update public.pre_sales
set tracking_protocol =
  left(
    regexp_replace(
      upper(coalesce(companies.trade_name, companies.legal_name, 'CRM')),
      '[^A-Z0-9]+',
      '',
      'g'
    ),
    10
  ) ||
  '-' ||
  to_char(coalesce(created_at, now()) at time zone 'America/Sao_Paulo', 'YYYYMMDD') ||
  '-' ||
  upper(substr(replace(id::text, '-', ''), 1, 8))
from public.companies
where pre_sales.company_id = companies.id
  and tracking_protocol is null;

create unique index if not exists pre_sales_company_tracking_protocol_idx
  on public.pre_sales (company_id, tracking_protocol)
  where tracking_protocol is not null;

create table if not exists public.client_tracking_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  pre_sale_id uuid not null references public.pre_sales(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  visible_to_client boolean not null default true,
  event_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid null references public.user_profiles(id) on delete set null,
  updated_at timestamptz null,
  deleted_by uuid null references public.user_profiles(id) on delete set null,
  deleted_at timestamptz null
);

create index if not exists client_tracking_updates_client_event_idx
  on public.client_tracking_updates (company_id, client_id, event_at desc)
  where deleted_at is null;

create index if not exists client_tracking_updates_pre_sale_event_idx
  on public.client_tracking_updates (company_id, pre_sale_id, event_at desc)
  where deleted_at is null;

create index if not exists client_tracking_updates_public_lookup_idx
  on public.client_tracking_updates (
    company_id,
    client_id,
    pre_sale_id,
    visible_to_client,
    event_at desc
  )
  where deleted_at is null;

alter table public.client_tracking_updates enable row level security;
