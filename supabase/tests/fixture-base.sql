-- Fixture minima pra testar 0001/0002 num Postgres vanilla (sem Supabase),
-- reproduzindo so o suficiente: enums, tabelas companies/user_profiles e as
-- 4 funcoes current_user_* copiadas verbatim do dump real de producao
-- (scripts/homologacao/schema-producao.sql), trocando so auth.uid() por um
-- mock controlavel via GUC de sessao.

create extension if not exists pgcrypto;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
    language sql stable
as $$
    select nullif(current_setting('app.test_uid', true), '')::uuid
$$;

create type public.company_status as enum ('active', 'inactive');
create type public.user_role as enum ('admin', 'manager', 'seller');

create table public.companies (
    id uuid default gen_random_uuid() primary key,
    legal_name text not null,
    trade_name text,
    status public.company_status default 'active' not null,
    created_at timestamptz default now() not null
);

create table public.user_profiles (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id),
    auth_user_id uuid not null unique,
    full_name text not null,
    email text not null,
    username text not null,
    role public.user_role default 'seller' not null,
    is_active boolean default true not null
);

-- Copiado verbatim de scripts/homologacao/schema-producao.sql linhas 189-280
create function public.current_user_company_id() returns uuid
    language sql stable security definer
    set search_path to 'public', 'pg_temp'
    as $$
  select up.company_id
  from public.user_profiles up
  where up.auth_user_id = (select auth.uid())
  limit 1
$$;

create function public.current_user_is_active() returns boolean
    language sql stable security definer
    set search_path to 'public', 'pg_temp'
    as $$
  select coalesce((
    select up.is_active
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

create function public.current_user_is_admin_or_manager() returns boolean
    language sql stable security definer
    set search_path to 'public', 'pg_temp'
    as $$
  select coalesce((
    select up.is_active and up.role in ('admin', 'manager')
    from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

create function public.current_user_profile_id() returns uuid
    language sql stable security definer
    set search_path to 'public', 'pg_temp'
    as $$
  select up.id
  from public.user_profiles up
  where up.auth_user_id = (select auth.uid())
  limit 1
$$;

-- Roles com os MESMOS NOMES que o Supabase usa de verdade (authenticated,
-- service_role), pra testar exatamente os GRANT/REVOKE das migracoes reais.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to authenticated, anon, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
-- Sem policy propria pras duas acima (nao sao o alvo deste teste) —
-- authenticated so consegue ver a propria linha via current_user_profile_id
-- pra nao mascarar erro; service_role ignora RLS (bypassrls).
create policy user_profiles_self on public.user_profiles
    for select using (auth_user_id = (select auth.uid()) or public.current_user_is_admin_or_manager());
create policy companies_all on public.companies for select using (true);
