-- Suite de aceite pra supabase/migrations/0003_equipes_integridade_transferencia_empresa.sql.
--
-- Mesmo padrao de automacao real do 0002.test.sql (SQLSTATE checado em
-- bloco DO com EXCEPTION, ON_ERROR_STOP=1, sem inspecao manual de log).
--
-- Como rodar (precisa de 0001+0002+0003 ja aplicadas na mesma base de
-- teste — ver cabecalho de 0002_equipes_integridade_empresa.test.sql pro
-- passo a passo completo):
--
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/migrations/0003_equipes_integridade_transferencia_empresa.sql
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/tests/0003_equipes_integridade_transferencia_empresa.test.sql

\set ON_ERROR_STOP on

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000c1', 'Empresa de teste C (0003)'),
    ('00000000-0000-0000-0000-0000000000d1', 'Empresa de teste D (0003)')
on conflict (id) do nothing;

insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
    ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000020c1', 'Usuario C1', 'usuarioc1@teste', 'usuarioc1', 'seller', true),
    ('00000000-0000-0000-0000-0000000010c2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000020c2', 'Usuario C2 (sem equipe)', 'usuarioc2@teste', 'usuarioc2', 'seller', true)
on conflict (id) do nothing;

insert into public.teams (id, company_id, name) values
    ('00000000-0000-0000-0000-0000000030c1', '00000000-0000-0000-0000-0000000000c1', 'Equipe de teste C')
on conflict (id) do nothing;

-- Vinculo criado direto (sem RLS, ja estamos como superuser aqui) so pra
-- montar o cenario "usuario com equipe ativa na empresa atual".
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030c1', '00000000-0000-0000-0000-0000000010c1', 'member')
on conflict (team_id, user_profile_id) do nothing;

\echo '=== TESTE 1 (0003): mudar company_id de usuario COM vinculo de equipe ativo -> esperado FALHA (NS004) ==='
do $$
begin
    update public.user_profiles
    set company_id = '00000000-0000-0000-0000-0000000000d1'
    where id = '00000000-0000-0000-0000-0000000010c1';

    raise exception 'TESTE 1 (0003) FALHOU: mudanca de empresa com vinculo ativo deveria ter sido bloqueada mas teve sucesso';
exception
    when sqlstate 'NS004' then
        raise notice 'TESTE 1 (0003) OK: bloqueado pelo trigger (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 2 (0003): mudar company_id de usuario SEM nenhum vinculo de equipe -> esperado SUCESSO ==='
do $$
declare
    v_company_final uuid;
begin
    update public.user_profiles
    set company_id = '00000000-0000-0000-0000-0000000000d1'
    where id = '00000000-0000-0000-0000-0000000010c2';

    select company_id into v_company_final
    from public.user_profiles
    where id = '00000000-0000-0000-0000-0000000010c2';

    if v_company_final <> '00000000-0000-0000-0000-0000000000d1' then
        raise exception 'TESTE 2 (0003) FALHOU: esperava company_id atualizado, achou %', v_company_final;
    end if;

    raise notice 'TESTE 2 (0003) OK: usuario sem vinculo mudou de empresa livremente';
end;
$$;

\echo '=== TESTE 3 (0003): apos remover o vinculo explicitamente, a mudanca de empresa passa a funcionar -> esperado SUCESSO ==='
do $$
declare
    v_company_final uuid;
begin
    delete from public.team_memberships
    where team_id = '00000000-0000-0000-0000-0000000030c1'
      and user_profile_id = '00000000-0000-0000-0000-0000000010c1';

    update public.user_profiles
    set company_id = '00000000-0000-0000-0000-0000000000d1'
    where id = '00000000-0000-0000-0000-0000000010c1';

    select company_id into v_company_final
    from public.user_profiles
    where id = '00000000-0000-0000-0000-0000000010c1';

    if v_company_final <> '00000000-0000-0000-0000-0000000000d1' then
        raise exception 'TESTE 3 (0003) FALHOU: esperava company_id atualizado apos remover vinculo, achou %', v_company_final;
    end if;

    raise notice 'TESTE 3 (0003) OK: vinculo removido explicitamente, mudanca de empresa permitida';
end;
$$;

\echo '=== TODOS OS 3 TESTES DE 0003 PASSARAM ==='
