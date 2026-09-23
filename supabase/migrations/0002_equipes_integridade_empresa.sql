-- Corrige uma lacuna real de integridade em 0001_equipes.sql: as policies
-- de team_memberships conferiam a empresa da EQUIPE e o papel do ATOR, mas
-- nunca conferiam se o USUARIO-ALVO (user_profile_id sendo inserido/
-- atualizado) de fato pertence aquela empresa. Um admin/manager da empresa A
-- podia, em tese, vincular o user_profile de um usuario da empresa B a uma
-- equipe da empresa A, bastando conhecer o UUID dele.
--
-- Esta migracao e uma correcao INCREMENTAL, nao uma reescrita de
-- 0001_equipes.sql — aplicada tanto se 0001 ja rodou em algum ambiente
-- quanto se ainda nao rodou (idempotente via CREATE OR REPLACE / DROP ...
-- IF EXISTS). Nao pressupor que o arquivo antigo sozinho, editado depois
-- dele ja ter sido aplicado, corrigiria um banco onde ele ja rodou.
--
-- Importante: a checagem abaixo usa user_profiles.company_id (a fonte de
-- verdade ATUAL, 1 empresa por perfil). Quando a fundacao de vinculo
-- usuario<->empresa N:N (company_memberships) existir, esta funcao precisa
-- ser atualizada para consultar aquela tabela em vez do campo legado —
-- deixar isso registrado aqui explicitamente para nao ser esquecido.
--
-- Pre-condicao: 0001_equipes.sql (tabelas teams/team_memberships) aplicada.
--
-- Verificacao antes de travar: como as tabelas sao novas e nenhum codigo
-- ainda escreve nelas (Fase 1 nao consome team_memberships em nenhuma
-- tela), nao ha necessidade de reassociar dados existentes — mas, por
-- seguranca, o bloco abaixo verifica e aborta com erro claro em vez de
-- corrigir silenciosamente, caso encontre uma linha ja inconsistente.
--
-- SQLSTATEs customizados usados nos triggers abaixo (retificado 23/09,
-- sem mudar a logica de validacao — so pra permitir teste automatizado
-- de verdade em vez de inspecao manual de mensagem, ver
-- supabase/tests/0002_equipes_integridade_empresa.test.sql):
--   NS001 — equipe do vinculo nao existe.
--   NS002 — usuario-alvo de empresa diferente da equipe (integridade).
--   NS003 — tentativa de mudar company_id de uma equipe existente.

do $$
declare
    v_inconsistentes integer;
begin
    select count(*) into v_inconsistentes
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    join public.user_profiles up on up.id = tm.user_profile_id
    where up.company_id <> t.company_id;

    if v_inconsistentes > 0 then
        raise exception
            'Encontradas % linhas em team_memberships com usuario de empresa diferente da equipe. '
            'Revise manualmente antes de aplicar esta migracao (nao apagar/reassociar automaticamente).',
            v_inconsistentes;
    end if;
end $$;

-- Helper reaproveitavel: hoje consulta user_profiles.company_id; atualizar
-- aqui (so aqui) quando company_memberships existir.
create or replace function public.user_belongs_to_company(p_user_profile_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_profiles up
        where up.id = p_user_profile_id
          and up.company_id = p_company_id
    );
$$;

comment on function public.user_belongs_to_company(uuid, uuid) is
    'Fonte de verdade unica para "este user_profile pertence a esta empresa?". '
    'Hoje consulta user_profiles.company_id (1:1). Atualizar quando existir '
    'company_memberships (N:N) — nao duplicar essa checagem em outro lugar.';

revoke all on function public.user_belongs_to_company(uuid, uuid) from public;
grant execute on function public.user_belongs_to_company(uuid, uuid) to authenticated, service_role;

-- Trigger de integridade estrutural: roda pra QUALQUER conexao, inclusive
-- service role (que ignora RLS) e scripts administrativos — RLS sozinha
-- nao bloqueia bypass de RLS, um trigger de tabela bloqueia.
create or replace function public.enforce_team_membership_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_team_company_id uuid;
begin
    select company_id into v_team_company_id
    from public.teams
    where id = new.team_id;

    if v_team_company_id is null then
        raise exception 'Equipe % nao encontrada.', new.team_id
            using errcode = 'NS001';
    end if;

    if not public.user_belongs_to_company(new.user_profile_id, v_team_company_id) then
        raise exception
            'Usuario % nao pertence a mesma empresa da equipe % — vinculo recusado.',
            new.user_profile_id, new.team_id
            using errcode = 'NS002';
    end if;

    return new;
end;
$$;

drop trigger if exists team_memberships_enforce_company on public.team_memberships;
create trigger team_memberships_enforce_company
    before insert or update of team_id, user_profile_id
    on public.team_memberships
    for each row
    execute function public.enforce_team_membership_company();

-- Empresa de uma equipe e imutavel depois de criada: "mover" uma equipe pra
-- outra empresa invalidaria silenciosamente os vinculos existentes (que
-- passariam a apontar pra usuarios de uma empresa diferente da nova). Se um
-- dia isso for necessario de verdade, fazer explicitamente (apagar os
-- vinculos antigos primeiro), nao via UPDATE direto de company_id.
create or replace function public.prevent_team_company_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.company_id <> old.company_id then
        raise exception
            'Nao e permitido mudar a empresa de uma equipe existente (equipe %). '
            'Crie uma equipe nova na empresa correta em vez de mover esta.',
            old.id
            using errcode = 'NS003';
    end if;
    return new;
end;
$$;

drop trigger if exists teams_prevent_company_change on public.teams;
create trigger teams_prevent_company_change
    before update of company_id
    on public.teams
    for each row
    execute function public.prevent_team_company_change();
