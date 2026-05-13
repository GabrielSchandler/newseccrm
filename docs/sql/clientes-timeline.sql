create table if not exists public.client_timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  pre_sale_id uuid null references public.pre_sales(id) on delete set null,
  event_type text not null,
  title text not null,
  note text null,
  actor_user_profile_id uuid null references public.user_profiles(id) on delete set null,
  actor_role text null,
  actor_business_area text null,
  actor_name text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_timeline_events_company_client_created_at_idx
  on public.client_timeline_events (company_id, client_id, created_at desc);

create index if not exists client_timeline_events_company_pre_sale_created_at_idx
  on public.client_timeline_events (company_id, pre_sale_id, created_at desc);
