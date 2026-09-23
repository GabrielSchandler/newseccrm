-- Equipes e vinculo supervisor/membro <-> equipe (N:N).
--
-- Objetivo: o CRM hoje nao tem conceito de equipe nenhum (so o Focus tem,
-- separado, e la um lider fica restrito a UMA equipe via coluna escalar —
-- ver docs/SOURCE_INVENTORY.md secao 3.3). A especificacao pede supervisor
-- em varias equipes (secao 5). Esta migracao cria a base para isso dentro
-- do CRM, de forma aditiva: nenhuma tabela existente e alterada, nenhum
-- codigo hoje le estas tabelas, entao aplicar isto tem risco de regressao
-- zero sobre o que ja funciona.
--
-- Pre-condicoes: tabelas public.companies e public.user_profiles ja
-- existem (schema do GRSCRM). Funcoes current_user_company_id(),
-- current_user_is_active(), current_user_is_admin_or_manager() e
-- current_user_profile_id() ja existem (docs/sql/security-multi-tenant-rls.sql
-- no CRM de origem) e sao reaproveitadas aqui para manter a mesma regra de
-- isolamento por empresa que o resto do banco ja usa.
--
-- Nao inclui: vinculo usuario <-> multiplas empresas (isso muda
-- src/lib/auth/current-user.ts e src/lib/supabase/middleware.ts, codigo de
-- autenticacao critico; requer sessao dedicada de teste com 2+ empresas
-- antes de mudar, nao entra numa migracao "de passagem" — ver
-- docs/PERMISSIONS.md secao 3).
--
-- Impacto no CRM antigo (GRSCRM, banco de producao): nenhum, ate esta
-- migracao ser aplicada la. Aplicada, tambem nao muda nenhum comportamento
-- existente — so acrescenta tabelas novas que nada consome ainda.
-- Estrategia de recuperacao: `drop table if exists public.team_memberships;
-- drop table if exists public.teams;` — seguro enquanto nada grava dados
-- reais nelas.

create table public.teams (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    business_area text default 'commercial' not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint teams_business_area_check check (business_area in ('commercial', 'legal')),
    constraint teams_company_name_unique unique (company_id, name)
);

comment on table public.teams is
    'Equipes dentro de uma empresa. Novo no NewSec — o CRM original (GRSCRM) nao tinha esse conceito.';

create index teams_company_id_idx on public.teams (company_id);

create table public.team_memberships (
    id uuid default gen_random_uuid() primary key,
    team_id uuid not null references public.teams(id) on delete cascade,
    user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
    membership_role text default 'member' not null,
    created_at timestamp with time zone default now() not null,
    constraint team_memberships_role_check check (membership_role in ('supervisor', 'member')),
    constraint team_memberships_unique unique (team_id, user_profile_id)
);

comment on table public.team_memberships is
    'Vinculo usuario <-> equipe (N:N). Um user_profile pode estar em varias equipes, '
    'inclusive como supervisor de mais de uma — diferente da restricao de 1 equipe do Focus.';

create index team_memberships_user_profile_id_idx on public.team_memberships (user_profile_id);
create index team_memberships_team_id_idx on public.team_memberships (team_id);

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

-- Leitura: qualquer usuario ativo da mesma empresa ve as equipes dela.
create policy teams_select on public.teams
    for select
    using (
        current_user_is_active()
        and company_id = current_user_company_id()
    );

-- Escrita: só admin/manager da empresa cria/edita/apaga equipes.
create policy teams_insert on public.teams
    for insert
    with check (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

create policy teams_update on public.teams
    for update
    using (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    )
    with check (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

create policy teams_delete on public.teams
    for delete
    using (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

-- team_memberships nao tem company_id proprio — o isolamento passa pela
-- equipe (public.teams), que ja tem RLS por empresa.
create policy team_memberships_select on public.team_memberships
    for select
    using (
        current_user_is_active()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_insert on public.team_memberships
    for insert
    with check (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_update on public.team_memberships
    for update
    using (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    )
    with check (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_delete on public.team_memberships
    for delete
    using (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );
