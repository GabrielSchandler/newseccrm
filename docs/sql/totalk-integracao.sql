-- Integracao Totalk por empresa.
-- Rode no SQL Editor do Supabase antes de configurar o token em Gestao > Integracoes.

begin;

create table if not exists public.totalk_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  api_base_url text not null default 'https://api.app.totalk.chat',
  encrypted_api_token text not null,
  default_sender_phone text null,
  default_send_message text null,
  is_active boolean not null default true,
  connected_by uuid null references public.user_profiles(id) on delete set null,
  last_import_at timestamptz null,
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique (company_id)
);

create index if not exists totalk_integrations_company_idx
  on public.totalk_integrations(company_id);

alter table public.totalk_integrations enable row level security;

drop policy if exists totalk_integrations_select_own_company on public.totalk_integrations;
create policy totalk_integrations_select_own_company
  on public.totalk_integrations
  for select
  to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin_or_manager()
  );

drop policy if exists totalk_integrations_manage_admin_manager on public.totalk_integrations;
create policy totalk_integrations_manage_admin_manager
  on public.totalk_integrations
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
