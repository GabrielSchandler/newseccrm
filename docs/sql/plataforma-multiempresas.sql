-- Painel de plataforma multiempresa.
-- Execute este arquivo completo no SQL Editor do Supabase.
-- Depois, marque o usuario dono da plataforma:
-- update public.user_profiles
-- set is_platform_owner = true, role = 'admin', is_active = true
-- where auth_user_id = 'COLE_AQUI_O_AUTH_USER_ID_DO_DONO';

begin;

alter table public.user_profiles
  add column if not exists is_platform_owner boolean not null default false;

create index if not exists user_profiles_platform_owner_idx
  on public.user_profiles (auth_user_id, is_platform_owner, is_active);

create or replace function public.current_user_is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select up.is_active and up.is_platform_owner
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

revoke all on function public.current_user_is_platform_owner() from public;
grant execute on function public.current_user_is_platform_owner() to authenticated;

alter table public.companies enable row level security;

drop policy if exists companies_select_platform_owner on public.companies;
create policy companies_select_platform_owner
  on public.companies
  for select
  to authenticated
  using (public.current_user_is_platform_owner());

drop policy if exists companies_insert_platform_owner on public.companies;
create policy companies_insert_platform_owner
  on public.companies
  for insert
  to authenticated
  with check (public.current_user_is_platform_owner());

drop policy if exists companies_update_platform_owner on public.companies;
create policy companies_update_platform_owner
  on public.companies
  for update
  to authenticated
  using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());

drop policy if exists user_profiles_platform_owner_all on public.user_profiles;
create policy user_profiles_platform_owner_all
  on public.user_profiles
  for all
  to authenticated
  using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());

do $$
declare
  table_record record;
  policy_name text;
  qualified_table text;
begin
  for table_record in
    select distinct c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'user_profiles'
  loop
    qualified_table := format('public.%I', table_record.table_name);
    policy_name := table_record.table_name || '_platform_owner_all';

    execute format('alter table %s enable row level security', qualified_table);
    execute format('drop policy if exists %I on %s', policy_name, qualified_table);
    execute format(
      'create policy %I on %s for all to authenticated using (public.current_user_is_platform_owner()) with check (public.current_user_is_platform_owner())',
      policy_name,
      qualified_table
    );
  end loop;
end $$;

drop policy if exists storage_objects_platform_owner_select on storage.objects;
create policy storage_objects_platform_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('documents', 'backups')
    and public.current_user_is_platform_owner()
  );

drop policy if exists storage_objects_platform_owner_insert on storage.objects;
create policy storage_objects_platform_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('documents', 'backups')
    and public.current_user_is_platform_owner()
  );

drop policy if exists storage_objects_platform_owner_update on storage.objects;
create policy storage_objects_platform_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('documents', 'backups')
    and public.current_user_is_platform_owner()
  )
  with check (
    bucket_id in ('documents', 'backups')
    and public.current_user_is_platform_owner()
  );

drop policy if exists storage_objects_platform_owner_delete on storage.objects;
create policy storage_objects_platform_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('documents', 'backups')
    and public.current_user_is_platform_owner()
  );

commit;
