-- Auditoria de RLS multiempresa.
-- Rode apos docs/sql/security-multi-tenant-rls.sql para conferir cobertura.

with critical_tables(table_name) as (
  values
    ('companies'),
    ('user_profiles'),
    ('clients'),
    ('pre_sales'),
    ('pre_sale_client_snapshot'),
    ('pre_sale_debt_holders'),
    ('pre_sale_financial_cases'),
    ('pre_sale_payments'),
    ('financing_calculations'),
    ('document_templates'),
    ('generated_documents'),
    ('client_documents'),
    ('client_timeline_events'),
    ('client_tracking_updates'),
    ('company_audit_logs'),
    ('email_integrations'),
    ('email_templates'),
    ('email_logs'),
    ('backup_jobs'),
    ('legacy_rd_import'),
    ('rd_crm_activity_import'),
    ('rd_crm_activity_import_batches')
),
rls_status as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
policy_counts as (
  select
    schemaname,
    tablename as table_name,
    count(*) as policy_count,
    string_agg(policyname, ', ' order by policyname) as policies
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
)
select
  ct.table_name,
  case
    when to_regclass('public.' || ct.table_name) is null then 'nao_existe'
    when coalesce(rs.rls_enabled, false) = false then 'falha_rls_desligado'
    when coalesce(pc.policy_count, 0) = 0 then 'falha_sem_policy'
    else 'ok'
  end as status,
  coalesce(rs.rls_enabled, false) as rls_enabled,
  coalesce(pc.policy_count, 0) as policy_count,
  pc.policies
from critical_tables ct
left join rls_status rs on rs.table_name = ct.table_name
left join policy_counts pc on pc.table_name = ct.table_name
order by
  case
    when to_regclass('public.' || ct.table_name) is null then 3
    when coalesce(rs.rls_enabled, false) = false then 0
    when coalesce(pc.policy_count, 0) = 0 then 1
    else 2
  end,
  ct.table_name;

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'storage_documents_tenant_%'
order by policyname;
