-- Suite de aceite pra supabase/migrations/0001_equipes.sql +
-- 0002_equipes_integridade_empresa.sql, cobrindo o checklist de
-- "Aceite obrigatorio no PostgreSQL de teste" (docs/PROGRESS.md).
--
-- Reescrita em 23/09/2026 pra ser automatizada de verdade — a versao
-- anterior rodava com `\set ON_ERROR_STOP off` e dependia de alguem ler as
-- mensagens de ERROR no log e comparar manualmente com o RAISE NOTICE
-- esperado. Isso tem dois problemas reais: (1) `psql` sempre retorna exit
-- code 0 nesse modo, entao "a suite rodou" nao provava "os testes
-- passaram" — um CI ou script rodando isto nunca detectaria regressao; (2)
-- o TESTE 4 original (auto-promocao) inseria o MESMO par (team_id,
-- user_profile_id) que o TESTE 1 ja tinha inserido antes — a falha
-- observada podia ser a violacao de RLS esperada OU a violacao da
-- constraint `team_memberships_unique`, e nao havia como saber qual das
-- duas realmente disparou.
--
-- Agora cada caso "esperado FALHA" roda dentro de um bloco DO com
-- EXCEPTION que checa o SQLSTATE especifico esperado — se a operacao tiver
-- sucesso (nao deveria), ou falhar por um motivo diferente do esperado
-- (teste contaminado por outra causa), o proprio script levanta um erro
-- SEM handler pra ele, que aborta a transacao/script com `ON_ERROR_STOP=1`
-- e devolve exit code != 0 pro psql — de verdade automatizavel.
--
-- Como rodar (precisa de um Postgres vazio, local ou descartavel — NUNCA
-- rodar isto contra homologacao ou producao, ele cria roles e tabelas):
--
--   createdb testeequipes
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/tests/fixture-base.sql
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/migrations/0001_equipes.sql
--   psql -d testeequipes -c "grant select, insert, update, delete on public.teams, public.team_memberships to authenticated, service_role;"
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/migrations/0002_equipes_integridade_empresa.sql
--   psql -d testeequipes -v ON_ERROR_STOP=1 -f supabase/tests/0002_equipes_integridade_empresa.test.sql
--   echo "exit code: $?"   # 0 = todos os testes passaram; != 0 = alguma falhou (mensagem indica qual)
--   dropdb testeequipes
--
-- Reexecutar sempre que 0001/0002 mudar.

\set ON_ERROR_STOP on

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000a1', 'Empresa de teste A'),
    ('00000000-0000-0000-0000-0000000000b1', 'Empresa de teste B')
on conflict (id) do nothing;

insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
    ('00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000020a1', 'Gerente A', 'gerentea@teste', 'gerentea', 'admin', true),
    ('00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000020a2', 'Membro A', 'membroa@teste', 'membroa', 'seller', true),
    ('00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000020b1', 'Gerente B', 'gerenteb@teste', 'gerenteb', 'admin', true),
    ('00000000-0000-0000-0000-0000000010b2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000020b2', 'Membro B', 'membrob@teste', 'membrob', 'seller', true)
on conflict (id) do nothing;

insert into public.teams (id, company_id, name) values
    ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000000a1', 'Equipe de teste A'),
    ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000000b1', 'Equipe de teste B')
on conflict (id) do nothing;

\echo '=== TESTE 1: Membro A (seller) tenta se auto-vincular como supervisor, SEM vinculo previo -> esperado FALHA (RLS, nao unique_violation) ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000020a2';
    set local role authenticated;

    insert into public.team_memberships (team_id, user_profile_id, membership_role)
    values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010a2', 'supervisor');

    raise exception 'TESTE 1 FALHOU: insercao deveria ter sido bloqueada por RLS mas teve sucesso';
exception
    when insufficient_privilege then
        raise notice 'TESTE 1 OK: bloqueado por RLS (SQLSTATE %)', sqlstate;
    when unique_violation then
        raise exception 'TESTE 1 CONTAMINADO: falhou por unique_violation, nao por RLS — dado de teste com colisao';
end;
$$;

\echo '=== TESTE 2: Gerente A vincula Membro A a Equipe A -> esperado SUCESSO ==='
begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010a2', 'member');
commit;

\echo '=== TESTE 3: Gerente A tenta vincular Membro B (empresa diferente) a Equipe A -> esperado FALHA (trigger NS002, nao RLS) ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
    set local role authenticated;

    insert into public.team_memberships (team_id, user_profile_id, membership_role)
    values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010b2', 'member');

    raise exception 'TESTE 3 FALHOU: insercao cross-empresa deveria ter sido bloqueada mas teve sucesso';
exception
    when sqlstate 'NS002' then
        raise notice 'TESTE 3 OK: bloqueado pelo trigger de integridade (SQLSTATE %)', sqlstate;
    when insufficient_privilege then
        raise exception 'TESTE 3 CONTAMINADO: bloqueado por RLS antes do trigger rodar — confira a ordem/policy de team_memberships_insert';
end;
$$;

\echo '=== TESTE 4: Gerente A tenta administrar Equipe B (equipe de outra empresa) -> esperado FALHA (RLS) ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
    set local role authenticated;

    insert into public.team_memberships (team_id, user_profile_id, membership_role)
    values ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000010b2', 'member');

    raise exception 'TESTE 4 FALHOU: administrar equipe alheia deveria ter sido bloqueado mas teve sucesso';
exception
    when insufficient_privilege then
        raise notice 'TESTE 4 OK: bloqueado por RLS (SQLSTATE %)', sqlstate;
    when sqlstate 'NS002' then
        raise exception 'TESTE 4 CONTAMINADO: bloqueado pelo trigger de integridade em vez de RLS — os dados desse caso nao deveriam violar integridade';
end;
$$;

\echo '=== TESTE 5: UPDATE tentando trocar o usuario do vinculo pra empresa diferente -> esperado FALHA (trigger NS002) ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
    set local role authenticated;

    update public.team_memberships
    set user_profile_id = '00000000-0000-0000-0000-0000000010b2'
    where team_id = '00000000-0000-0000-0000-0000000030a1'
      and user_profile_id = '00000000-0000-0000-0000-0000000010a2';

    raise exception 'TESTE 5 FALHOU: UPDATE cross-empresa deveria ter sido bloqueado mas teve sucesso';
exception
    when sqlstate 'NS002' then
        raise notice 'TESTE 5 OK: bloqueado pelo trigger de integridade (SQLSTATE %)', sqlstate;
    when insufficient_privilege then
        raise exception 'TESTE 5 CONTAMINADO: bloqueado por RLS antes do trigger rodar';
end;
$$;

\echo '=== TESTE 6: Revogacao remove o vinculo (DELETE) -> esperado SUCESSO, 0 linhas restantes ==='
do $$
declare
    v_restantes integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
    set local role authenticated;

    delete from public.team_memberships
    where team_id = '00000000-0000-0000-0000-0000000030a1'
      and user_profile_id = '00000000-0000-0000-0000-0000000010a2';

    select count(*) into v_restantes
    from public.team_memberships
    where team_id = '00000000-0000-0000-0000-0000000030a1'
      and user_profile_id = '00000000-0000-0000-0000-0000000010a2';

    if v_restantes <> 0 then
        raise exception 'TESTE 6 FALHOU: esperava 0 linhas restantes apos DELETE, achou %', v_restantes;
    end if;

    raise notice 'TESTE 6 OK: vinculo revogado, 0 linhas restantes';
end;
$$;

\echo '=== TESTE 7: insercao inconsistente direta, sem SET ROLE (equivalente a bypass de RLS via service_role) -> esperado FALHA (trigger NS002, roda mesmo sem RLS) ==='
-- Cada DO acima roda como sua propria transacao implicita (autocommit) — o
-- `set local role`/`set local app.test_uid` de TESTE 4/5 ja expirou junto
-- com aquela transacao, entao este bloco ja roda com a role/sessao padrao
-- da conexao (tipicamente superuser local, que ignora RLS por definicao —
-- e exatamente o "equivalente a bypass" que este teste quer exercitar).
do $$
begin
    insert into public.team_memberships (team_id, user_profile_id, membership_role)
    values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010b2', 'member');

    raise exception 'TESTE 7 FALHOU: insercao inconsistente deveria ter sido bloqueada pelo trigger mesmo sem RLS, mas teve sucesso';
exception
    when sqlstate 'NS002' then
        raise notice 'TESTE 7 OK: trigger estrutural bloqueou mesmo com bypass de RLS (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 8: tentar mudar a empresa de uma equipe existente -> esperado FALHA (trigger NS003) ==='
do $$
begin
    update public.teams set company_id = '00000000-0000-0000-0000-0000000000b1'
    where id = '00000000-0000-0000-0000-0000000030a1';

    raise exception 'TESTE 8 FALHOU: mudar empresa da equipe deveria ter sido bloqueado mas teve sucesso';
exception
    when sqlstate 'NS003' then
        raise notice 'TESTE 8 OK: bloqueado pelo trigger de imutabilidade (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 9 (simetria): Gerente B vincula Membro B a Equipe B -> esperado SUCESSO ==='
begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020b1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000010b2', 'supervisor');
commit;

\echo '=== TODOS OS 9 TESTES PASSARAM (se chegou ate aqui sem ON_ERROR_STOP abortar, esta linha e a prova) ==='
