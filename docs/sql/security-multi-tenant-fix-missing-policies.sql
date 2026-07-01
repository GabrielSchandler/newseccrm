-- Correção complementar para tabelas com RLS ligado, mas sem policies.
-- Rode depois de docs/sql/security-multi-tenant-rls.sql.
-- Não altera dados; apenas cria/recria policies de isolamento por empresa.

begin;

-- Garante que os helpers existam mesmo se este arquivo for executado isoladamente.
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.company_id
  from public.user_profiles up
  where up.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select up.is_active
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

create or replace function public.current_user_is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select up.is_active and up.role in ('admin', 'manager')
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.id
  from public.user_profiles up
  where up.auth_user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_user_company_id() from public;
revoke all on function public.current_user_is_active() from public;
revoke all on function public.current_user_is_admin_or_manager() from public;
revoke all on function public.current_user_profile_id() from public;

grant execute on function public.current_user_company_id() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_is_admin_or_manager() to authenticated;
grant execute on function public.current_user_profile_id() to authenticated;

do $$
declare
  target_table text;
  qualified_table text;
begin
  foreach target_table in array array[
    'client_timeline_events',
    'client_tracking_updates'
  ]
  loop
    qualified_table := format('public.%I', target_table);

    if to_regclass(qualified_table) is not null then
      execute format('alter table %s enable row level security', qualified_table);

      execute format('drop policy if exists %I on %s', target_table || '_select_own_company', qualified_table);
      execute format(
        'create policy %I on %s for select to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active())',
        target_table || '_select_own_company',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_insert_own_company', qualified_table);
      execute format(
        'create policy %I on %s for insert to authenticated with check (company_id = public.current_user_company_id() and public.current_user_is_active())',
        target_table || '_insert_own_company',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_update_own_company', qualified_table);
      execute format(
        'create policy %I on %s for update to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active()) with check (company_id = public.current_user_company_id() and public.current_user_is_active())',
        target_table || '_update_own_company',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_delete_own_company', qualified_table);
      execute format(
        'create policy %I on %s for delete to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active())',
        target_table || '_delete_own_company',
        qualified_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.email_integrations') is not null then
    alter table public.email_integrations enable row level security;

    drop policy if exists email_integrations_select_own_company on public.email_integrations;
    create policy email_integrations_select_own_company
    on public.email_integrations
    for select
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_active()
    );

    drop policy if exists email_integrations_manage_own_or_admin on public.email_integrations;
    create policy email_integrations_manage_own_or_admin
    on public.email_integrations
    for all
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
  end if;

  if to_regclass('public.email_templates') is not null then
    alter table public.email_templates enable row level security;

    drop policy if exists email_templates_select_own_company on public.email_templates;
    create policy email_templates_select_own_company
    on public.email_templates
    for select
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_active()
    );

    drop policy if exists email_templates_manage_admin_manager on public.email_templates;
    create policy email_templates_manage_admin_manager
    on public.email_templates
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
  end if;

  if to_regclass('public.email_logs') is not null then
    alter table public.email_logs enable row level security;

    drop policy if exists email_logs_select_own_company on public.email_logs;
    create policy email_logs_select_own_company
    on public.email_logs
    for select
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_active()
    );

    drop policy if exists email_logs_insert_own_company on public.email_logs;
    create policy email_logs_insert_own_company
    on public.email_logs
    for insert
    to authenticated
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_active()
    );
  end if;
end $$;

do $$
declare
  target_table text;
  qualified_table text;
begin
  foreach target_table in array array[
    'legacy_rd_import',
    'rd_crm_activity_import',
    'rd_crm_activity_import_batches'
  ]
  loop
    qualified_table := format('public.%I', target_table);

    if to_regclass(qualified_table) is not null then
      execute format('alter table %s enable row level security', qualified_table);

      execute format('drop policy if exists %I on %s', target_table || '_select_admin_manager', qualified_table);
      execute format(
        'create policy %I on %s for select to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin_or_manager())',
        target_table || '_select_admin_manager',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_insert_admin_manager', qualified_table);
      execute format(
        'create policy %I on %s for insert to authenticated with check (company_id = public.current_user_company_id() and public.current_user_is_admin_or_manager())',
        target_table || '_insert_admin_manager',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_update_admin_manager', qualified_table);
      execute format(
        'create policy %I on %s for update to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin_or_manager()) with check (company_id = public.current_user_company_id() and public.current_user_is_admin_or_manager())',
        target_table || '_update_admin_manager',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', target_table || '_delete_admin_manager', qualified_table);
      execute format(
        'create policy %I on %s for delete to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_admin_or_manager())',
        target_table || '_delete_admin_manager',
        qualified_table
      );
    end if;
  end loop;
end $$;

commit;
