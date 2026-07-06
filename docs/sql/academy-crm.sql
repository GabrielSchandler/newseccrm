begin;

alter table public.company_platform_settings
  add column if not exists enable_academy boolean not null default true;

update public.company_platform_settings
set enable_academy = true
where enable_academy = false;

create table if not exists public.academy_chapter_progress (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  course_slug text not null,
  chapter_id text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'approved')),
  progress_percent integer not null default 0
    check (progress_percent between 0 and 100),
  best_score integer null check (best_score between 0 and 100),
  completed_at timestamptz null,
  last_activity_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique (company_id, user_profile_id, course_slug, chapter_id)
);

create table if not exists public.academy_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  course_slug text not null,
  chapter_id text not null,
  score integer not null check (score between 0 and 100),
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists academy_chapter_progress_company_user_idx
  on public.academy_chapter_progress(company_id, user_profile_id, course_slug);

create index if not exists academy_chapter_progress_company_course_idx
  on public.academy_chapter_progress(company_id, course_slug);

create index if not exists academy_exam_attempts_company_user_idx
  on public.academy_exam_attempts(company_id, user_profile_id, course_slug);

create index if not exists academy_exam_attempts_company_course_idx
  on public.academy_exam_attempts(company_id, course_slug);

alter table public.academy_chapter_progress enable row level security;
alter table public.academy_exam_attempts enable row level security;

drop policy if exists academy_chapter_progress_select_own_or_manager
  on public.academy_chapter_progress;
create policy academy_chapter_progress_select_own_or_manager
on public.academy_chapter_progress
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_is_active()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_is_admin_or_manager()
  )
);

drop policy if exists academy_chapter_progress_insert_own
  on public.academy_chapter_progress;
create policy academy_chapter_progress_insert_own
on public.academy_chapter_progress
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and user_profile_id = public.current_user_profile_id()
  and public.current_user_is_active()
);

drop policy if exists academy_chapter_progress_update_own_or_manager
  on public.academy_chapter_progress;
create policy academy_chapter_progress_update_own_or_manager
on public.academy_chapter_progress
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_is_active()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_is_admin_or_manager()
  )
)
with check (
  company_id = public.current_user_company_id()
  and public.current_user_is_active()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_is_admin_or_manager()
  )
);

drop policy if exists academy_chapter_progress_delete_manager
  on public.academy_chapter_progress;
create policy academy_chapter_progress_delete_manager
on public.academy_chapter_progress
for delete
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_is_admin_or_manager()
);

drop policy if exists academy_exam_attempts_select_own_or_manager
  on public.academy_exam_attempts;
create policy academy_exam_attempts_select_own_or_manager
on public.academy_exam_attempts
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_is_active()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_is_admin_or_manager()
  )
);

drop policy if exists academy_exam_attempts_insert_own
  on public.academy_exam_attempts;
create policy academy_exam_attempts_insert_own
on public.academy_exam_attempts
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and user_profile_id = public.current_user_profile_id()
  and public.current_user_is_active()
);

drop policy if exists academy_exam_attempts_delete_manager
  on public.academy_exam_attempts;
create policy academy_exam_attempts_delete_manager
on public.academy_exam_attempts
for delete
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_is_admin_or_manager()
);

commit;
