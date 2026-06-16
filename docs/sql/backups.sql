insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  false,
  1073741824,
  array['application/zip']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by uuid null references public.user_profiles(id) on delete set null,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'scheduled')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  backup_name text not null,
  storage_bucket text not null default 'backups',
  storage_path text null,
  file_size_bytes bigint null,
  manifest jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index if not exists backup_jobs_company_created_idx
  on public.backup_jobs(company_id, created_at desc);

create index if not exists backup_jobs_company_status_idx
  on public.backup_jobs(company_id, status, created_at desc);

create index if not exists backup_jobs_expires_idx
  on public.backup_jobs(expires_at);

alter table public.backup_jobs enable row level security;

drop policy if exists backup_jobs_select_admin on public.backup_jobs;
create policy backup_jobs_select_admin
on public.backup_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = auth.uid()
      and up.company_id = backup_jobs.company_id
      and up.role = 'admin'
  )
);
