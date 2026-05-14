alter table public.user_profiles
  add column if not exists legal_role text;

update public.user_profiles
set legal_role = 'admin'
where business_area = 'legal'
  and legal_role is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_legal_role_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_legal_role_check
      check (legal_role is null or legal_role in ('admin', 'consultant'));
  end if;
end $$;

create index if not exists user_profiles_legal_role_idx
  on public.user_profiles (company_id, business_area, legal_role)
  where is_active = true;

alter table public.clients
  add column if not exists legal_consultant_user_id uuid null references public.user_profiles(id) on delete set null;

create index if not exists clients_legal_consultant_user_id_idx
  on public.clients (company_id, legal_consultant_user_id);
