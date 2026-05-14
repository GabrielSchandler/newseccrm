create table if not exists public.email_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  provider text not null default 'microsoft',
  provider_user_id text null,
  email text not null,
  display_name text null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}'::text[],
  connected_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique (company_id, user_profile_id, provider)
);

create index if not exists email_integrations_company_user_idx
  on public.email_integrations(company_id, user_profile_id);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  business_area text not null default 'legal',
  legal_stage text null,
  recipient_mode text not null default 'client',
  subject_template text not null,
  body_template text not null,
  cc_template text null,
  bcc_template text null,
  is_active boolean not null default true,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_templates_recipient_mode_check'
  ) then
    alter table public.email_templates
      add constraint email_templates_recipient_mode_check
      check (recipient_mode in ('client', 'bank', 'client_bank', 'custom'));
  end if;
end $$;

create index if not exists email_templates_company_area_idx
  on public.email_templates(company_id, business_area, is_active, name);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  pre_sale_id uuid null references public.pre_sales(id) on delete set null,
  template_id uuid null references public.email_templates(id) on delete set null,
  legal_stage text null,
  sender_user_profile_id uuid null references public.user_profiles(id) on delete set null,
  action_by_user_profile_id uuid null references public.user_profiles(id) on delete set null,
  sender_email text not null,
  mode text not null,
  status text not null,
  subject text not null,
  body text not null,
  recipients jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  microsoft_message_id text null,
  error_message text null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_logs_mode_check'
  ) then
    alter table public.email_logs
      add constraint email_logs_mode_check
      check (mode in ('draft', 'send'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_logs_status_check'
  ) then
    alter table public.email_logs
      add constraint email_logs_status_check
      check (status in ('draft_created', 'sent', 'error'));
  end if;
end $$;

create index if not exists email_logs_company_client_created_idx
  on public.email_logs(company_id, client_id, created_at desc);

create index if not exists email_logs_company_template_idx
  on public.email_logs(company_id, template_id, created_at desc);

alter table public.email_integrations enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_logs enable row level security;

drop policy if exists email_integrations_select_own on public.email_integrations;
create policy email_integrations_select_own
on public.email_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.id = email_integrations.user_profile_id
      and up.company_id = email_integrations.company_id
      and up.is_active = true
  )
);

drop policy if exists email_templates_select_company on public.email_templates;
create policy email_templates_select_company
on public.email_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = email_templates.company_id
      and up.is_active = true
  )
);

drop policy if exists email_templates_manage_admin_manager on public.email_templates;
create policy email_templates_manage_admin_manager
on public.email_templates
for all
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = email_templates.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = email_templates.company_id
      and up.is_active = true
      and up.role in ('admin', 'manager')
  )
);

drop policy if exists email_logs_select_company on public.email_logs;
create policy email_logs_select_company
on public.email_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = email_logs.company_id
      and up.is_active = true
  )
);

drop policy if exists email_logs_insert_company on public.email_logs;
create policy email_logs_insert_company
on public.email_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = email_logs.company_id
      and up.is_active = true
  )
);
