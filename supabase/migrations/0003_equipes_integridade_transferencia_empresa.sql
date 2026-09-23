-- Corrige uma lacuna de integridade nao coberta por 0002: o trigger de la
-- so valida no INSERT/UPDATE de team_memberships — nunca quando
-- user_profiles.company_id muda por fora (ex: um admin move um usuario pra
-- outra empresa). Se isso acontecer com vinculos de equipe existentes, eles
-- ficam apontando pra uma equipe de empresa diferente da nova empresa do
-- usuario — a mesma inconsistencia que 0002 bloqueia, so que pelo lado
-- inverso (mudou o usuario, nao o vinculo).
--
-- Nao ha hoje nenhuma tela/action no CRM que exponha editar company_id de
-- um user_profile ja existente (usuarios sao criados escopados pela empresa
-- ativa) — mas a coluna e um campo comum, sem constraint que impeca UPDATE
-- direto (ex: script administrativo, SQL Editor). Fechar a lacuna na
-- origem em vez de confiar em "ninguem faz isso pela UI hoje".
--
-- Mesma filosofia de 0002: bloquear com erro claro, nao apagar/reassociar
-- vinculo silenciosamente — quem for mover um usuario de empresa decide
-- explicitamente o que fazer com as equipes dele primeiro (nesta empresa).
--
-- Pre-condicao: 0001_equipes.sql e 0002_equipes_integridade_empresa.sql
-- aplicadas.
--
-- Concorrencia (limitacao conhecida, documentada em vez de ignorada): o
-- SELECT count(*) abaixo roda em READ COMMITTED (padrao do Postgres) e nao
-- toma lock sobre team_memberships. Uma transacao concorrente inserindo um
-- vinculo pro mesmo usuario, entre este SELECT e o commit desta transacao,
-- pode em teoria escapar da checagem. Nao ha hoje caminho de UI pra isso
-- acontecer (mudanca de company_id e so via SQL direto), e o trigger de
-- 0002 continua bloqueando o INSERT do vinculo em si sempre que ele
-- referenciar uma equipe de empresa diferente da atual do usuario — entao
-- o pior cenario e um vinculo antigo (da empresa de origem) sobreviver, nao
-- um vinculo novo incorreto sendo criado. Se este caminho virar uma
-- operacao real de produto, revisitar com `SELECT ... FOR UPDATE` explicito
-- ou SERIALIZABLE.
create or replace function public.prevent_company_change_with_active_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_vinculos integer;
begin
    if new.company_id = old.company_id then
        return new;
    end if;

    select count(*) into v_vinculos
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.user_profile_id = old.id
      and t.company_id = old.company_id;

    if v_vinculos > 0 then
        raise exception
            'Usuario % tem % vinculo(s) de equipe na empresa atual — remova-os explicitamente antes de mudar a empresa do usuario.',
            old.id, v_vinculos
            using errcode = 'NS004';
    end if;

    return new;
end;
$$;

comment on function public.prevent_company_change_with_active_teams() is
    'Bloqueia UPDATE de user_profiles.company_id enquanto existirem team_memberships '
    'do usuario numa equipe da empresa atual — evita vinculo orfao apontando pra '
    'equipe de empresa diferente da nova. SQLSTATE customizado NS004.';

drop trigger if exists user_profiles_prevent_company_change_with_teams on public.user_profiles;
create trigger user_profiles_prevent_company_change_with_teams
    before update of company_id
    on public.user_profiles
    for each row
    execute function public.prevent_company_change_with_active_teams();
