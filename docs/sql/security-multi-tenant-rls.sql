-- Hardening de seguranca multiempresa.
-- Objetivo: impor isolamento por company_id no banco, mesmo em acesso direto via PostgREST.
-- Este SQL e idempotente e pode ser executado mais de uma vez no Supabase SQL Editor.

begin;

-- =========================================================
-- HELPERS DE CONTEXTO DO USUARIO AUTENTICADO
-- =========================================================

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

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.role::text
  from public.user_profiles up
  where up.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_active()
    and public.current_user_role() = 'admin'
$$;

create or replace function public.current_user_is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_active()
    and public.current_user_role() in ('admin', 'manager')
$$;

revoke all on function public.current_user_profile_id() from public;
revoke all on function public.current_user_company_id() from public;
revoke all on function public.current_user_is_active() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin_or_manager() from public;

grant execute on function public.current_user_profile_id() to authenticated;
grant execute on function public.current_user_company_id() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_is_admin_or_manager() to authenticated;

-- =========================================================
-- FUNCOES AUXILIARES PARA TABELAS-FILHAS SEM COMPANY_ID
-- =========================================================

create or replace function public.client_belongs_to_current_company(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.company_id = public.current_user_company_id()
  )
$$;

create or replace function public.pre_sale_belongs_to_current_company(p_pre_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.pre_sales ps
    where ps.id = p_pre_sale_id
      and ps.company_id = public.current_user_company_id()
  )
$$;

revoke all on function public.client_belongs_to_current_company(uuid) from public;
revoke all on function public.pre_sale_belongs_to_current_company(uuid) from public;

grant execute on function public.client_belongs_to_current_company(uuid) to authenticated;
grant execute on function public.pre_sale_belongs_to_current_company(uuid) to authenticated;

-- =========================================================
-- TABELAS COM COMPANY_ID DIRETO
-- =========================================================

do $$
declare
  target_table_name text;
  qualified_table text;
  policy_prefix text;
begin
  foreach target_table_name in array array[
    'clients',
    'pre_sales',
    'generated_documents',
    'client_documents',
    'financing_calculations',
    'document_templates',
    'client_timeline_events',
    'client_tracking_updates',
    'rd_crm_activity_import',
    'rd_crm_activity_import_batches'
  ]
  loop
    qualified_table := format('public.%I', target_table_name);
    policy_prefix := target_table_name || '_tenant';

    if to_regclass(qualified_table) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table_name
          and column_name = 'company_id'
      )
    then
      execute format('alter table %s enable row level security', qualified_table);
      execute format('drop policy if exists %I on %s', policy_prefix || '_select', qualified_table);
      execute format(
        'create policy %I on %s for select to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active())',
        policy_prefix || '_select',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_insert', qualified_table);
      execute format(
        'create policy %I on %s for insert to authenticated with check (company_id = public.current_user_company_id() and public.current_user_is_active())',
        policy_prefix || '_insert',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_update', qualified_table);
      execute format(
        'create policy %I on %s for update to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active()) with check (company_id = public.current_user_company_id() and public.current_user_is_active())',
        policy_prefix || '_update',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_delete', qualified_table);
      execute format(
        'create policy %I on %s for delete to authenticated using (company_id = public.current_user_company_id() and public.current_user_is_active())',
        policy_prefix || '_delete',
        qualified_table
      );
    end if;
  end loop;
end $$;

-- =========================================================
-- REGRAS MAIS RESTRITAS PARA MODULOS ADMINISTRATIVOS
-- =========================================================

do $$
begin
  if to_regclass('public.document_templates') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'document_templates'
        and column_name = 'company_id'
    )
  then
    drop policy if exists document_templates_tenant_insert on public.document_templates;
    create policy document_templates_tenant_insert
    on public.document_templates
    for insert
    to authenticated
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists document_templates_tenant_update on public.document_templates;
    create policy document_templates_tenant_update
    on public.document_templates
    for update
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    )
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists document_templates_tenant_delete on public.document_templates;
    create policy document_templates_tenant_delete
    on public.document_templates
    for delete
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );
  end if;

  if to_regclass('public.rd_crm_activity_import') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'rd_crm_activity_import'
        and column_name = 'company_id'
    )
  then
    drop policy if exists rd_crm_activity_import_tenant_select on public.rd_crm_activity_import;
    create policy rd_crm_activity_import_tenant_select
    on public.rd_crm_activity_import
    for select
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_tenant_insert on public.rd_crm_activity_import;
    create policy rd_crm_activity_import_tenant_insert
    on public.rd_crm_activity_import
    for insert
    to authenticated
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_tenant_update on public.rd_crm_activity_import;
    create policy rd_crm_activity_import_tenant_update
    on public.rd_crm_activity_import
    for update
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    )
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_tenant_delete on public.rd_crm_activity_import;
    create policy rd_crm_activity_import_tenant_delete
    on public.rd_crm_activity_import
    for delete
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );
  end if;

  if to_regclass('public.rd_crm_activity_import_batches') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'rd_crm_activity_import_batches'
        and column_name = 'company_id'
    )
  then
    drop policy if exists rd_crm_activity_import_batches_tenant_select on public.rd_crm_activity_import_batches;
    create policy rd_crm_activity_import_batches_tenant_select
    on public.rd_crm_activity_import_batches
    for select
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_batches_tenant_insert on public.rd_crm_activity_import_batches;
    create policy rd_crm_activity_import_batches_tenant_insert
    on public.rd_crm_activity_import_batches
    for insert
    to authenticated
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_batches_tenant_update on public.rd_crm_activity_import_batches;
    create policy rd_crm_activity_import_batches_tenant_update
    on public.rd_crm_activity_import_batches
    for update
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    )
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists rd_crm_activity_import_batches_tenant_delete on public.rd_crm_activity_import_batches;
    create policy rd_crm_activity_import_batches_tenant_delete
    on public.rd_crm_activity_import_batches
    for delete
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );
  end if;
end $$;

-- =========================================================
-- COMPANIES
-- =========================================================

do $$
begin
  if to_regclass('public.companies') is not null then
    alter table public.companies enable row level security;

    drop policy if exists companies_tenant_select on public.companies;
    create policy companies_tenant_select
    on public.companies
    for select
    to authenticated
    using (id = public.current_user_company_id() and public.current_user_is_active());

    drop policy if exists companies_tenant_update_admin on public.companies;
    create policy companies_tenant_update_admin
    on public.companies
    for update
    to authenticated
    using (id = public.current_user_company_id() and public.current_user_is_admin())
    with check (id = public.current_user_company_id() and public.current_user_is_admin());
  end if;
end $$;

-- =========================================================
-- USER_PROFILES
-- =========================================================

do $$
begin
  if to_regclass('public.user_profiles') is not null then
    alter table public.user_profiles enable row level security;

    drop policy if exists user_profiles_tenant_select on public.user_profiles;
    create policy user_profiles_tenant_select
    on public.user_profiles
    for select
    to authenticated
    using (
      auth_user_id = (select auth.uid())
      or (
        company_id = public.current_user_company_id()
        and public.current_user_is_active()
      )
    );

    drop policy if exists user_profiles_tenant_insert_admin on public.user_profiles;
    create policy user_profiles_tenant_insert_admin
    on public.user_profiles
    for insert
    to authenticated
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists user_profiles_tenant_update_admin on public.user_profiles;
    create policy user_profiles_tenant_update_admin
    on public.user_profiles
    for update
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    )
    with check (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );

    drop policy if exists user_profiles_tenant_delete_admin on public.user_profiles;
    create policy user_profiles_tenant_delete_admin
    on public.user_profiles
    for delete
    to authenticated
    using (
      company_id = public.current_user_company_id()
      and public.current_user_is_admin_or_manager()
    );
  end if;
end $$;

-- =========================================================
-- TABELAS-FILHAS VINCULADAS A PRE_SALES
-- =========================================================

do $$
declare
  target_table_name text;
  qualified_table text;
  policy_prefix text;
begin
  foreach target_table_name in array array[
    'pre_sale_client_snapshot',
    'pre_sale_debt_holders',
    'pre_sale_financial_cases',
    'pre_sale_payments'
  ]
  loop
    qualified_table := format('public.%I', target_table_name);
    policy_prefix := target_table_name || '_tenant';

    if to_regclass(qualified_table) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table_name
          and column_name = 'pre_sale_id'
      )
    then
      execute format('alter table %s enable row level security', qualified_table);

      execute format('drop policy if exists %I on %s', policy_prefix || '_select', qualified_table);
      execute format(
        'create policy %I on %s for select to authenticated using (public.current_user_is_active() and public.pre_sale_belongs_to_current_company(pre_sale_id))',
        policy_prefix || '_select',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_insert', qualified_table);
      execute format(
        'create policy %I on %s for insert to authenticated with check (public.current_user_is_active() and public.pre_sale_belongs_to_current_company(pre_sale_id))',
        policy_prefix || '_insert',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_update', qualified_table);
      execute format(
        'create policy %I on %s for update to authenticated using (public.current_user_is_active() and public.pre_sale_belongs_to_current_company(pre_sale_id)) with check (public.current_user_is_active() and public.pre_sale_belongs_to_current_company(pre_sale_id))',
        policy_prefix || '_update',
        qualified_table
      );

      execute format('drop policy if exists %I on %s', policy_prefix || '_delete', qualified_table);
      execute format(
        'create policy %I on %s for delete to authenticated using (public.current_user_is_active() and public.pre_sale_belongs_to_current_company(pre_sale_id))',
        policy_prefix || '_delete',
        qualified_table
      );
    end if;
  end loop;
end $$;

-- =========================================================
-- STORAGE PRIVADO POR PREFIXO DE EMPRESA
-- =========================================================

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists storage_documents_tenant_select on storage.objects;
    create policy storage_documents_tenant_select
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id in ('documents', 'client-documents', 'calculation-reports')
      and (storage.foldername(name))[1] = public.current_user_company_id()::text
      and public.current_user_is_active()
    );

    drop policy if exists storage_documents_tenant_insert on storage.objects;
    create policy storage_documents_tenant_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id in ('documents', 'client-documents', 'calculation-reports')
      and (storage.foldername(name))[1] = public.current_user_company_id()::text
      and public.current_user_is_active()
    );

    drop policy if exists storage_documents_tenant_update on storage.objects;
    create policy storage_documents_tenant_update
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id in ('documents', 'client-documents', 'calculation-reports')
      and (storage.foldername(name))[1] = public.current_user_company_id()::text
      and public.current_user_is_active()
    )
    with check (
      bucket_id in ('documents', 'client-documents', 'calculation-reports')
      and (storage.foldername(name))[1] = public.current_user_company_id()::text
      and public.current_user_is_active()
    );

    drop policy if exists storage_documents_tenant_delete on storage.objects;
    create policy storage_documents_tenant_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id in ('documents', 'client-documents', 'calculation-reports')
      and (storage.foldername(name))[1] = public.current_user_company_id()::text
      and public.current_user_is_active()
    );
  end if;
end $$;

commit;
