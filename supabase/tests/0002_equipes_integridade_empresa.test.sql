-- Suite de aceite pra supabase/migrations/0001_equipes.sql +
-- 0002_equipes_integridade_empresa.sql, cobrindo o checklist de
-- "Aceite obrigatorio no PostgreSQL de teste" (docs/PROGRESS.md,
-- checkpoint de correcoes 2026-09-23).
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
--   dropdb testeequipes
--
-- Executado manualmente em 2026-09-23 (Postgres 17 local, ver
-- docs/PROGRESS.md para o registro) — todos os 9 casos abaixo passaram.
-- Reexecutar sempre que 0001/0002 mudar.

\set ON_ERROR_STOP off

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

do $$
begin
    raise notice '=== TESTE 1: Gerente A vincula Membro A a Equipe A -> esperado SUCESSO ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010a2', 'member');
commit;

do $$
begin
    raise notice '=== TESTE 2: Gerente A tenta vincular Membro B (empresa diferente) a Equipe A -> esperado FALHA ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010b2', 'member');
commit;

do $$
begin
    raise notice '=== TESTE 3: Gerente A tenta administrar Equipe B -> esperado FALHA (RLS) ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000010b2', 'member');
commit;

do $$
begin
    raise notice '=== TESTE 4: Membro A (seller) tenta se auto-vincular como supervisor -> esperado FALHA (RLS) ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a2';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010a2', 'supervisor');
commit;

do $$
begin
    raise notice '=== TESTE 5: UPDATE tentando trocar o usuario do vinculo pra empresa diferente -> esperado FALHA ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
update public.team_memberships
set user_profile_id = '00000000-0000-0000-0000-0000000010b2'
where team_id = '00000000-0000-0000-0000-0000000030a1'
  and user_profile_id = '00000000-0000-0000-0000-0000000010a2';
commit;

do $$
begin
    raise notice '=== TESTE 6: Revogacao remove o vinculo (DELETE) e ele some da consulta -> esperado SUCESSO, 0 linhas restantes ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020a1';
set local role authenticated;
delete from public.team_memberships
where team_id = '00000000-0000-0000-0000-0000000030a1'
  and user_profile_id = '00000000-0000-0000-0000-0000000010a2';
select count(*) as deve_ser_zero from public.team_memberships where team_id = '00000000-0000-0000-0000-0000000030a1';
commit;

do $$
begin
    raise notice '=== TESTE 7: insercao inconsistente direta, sem SET ROLE (equivalente a bypass de RLS) -> esperado FALHA (trigger estrutural) ===';
end $$;

insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000010b2', 'member');

do $$
begin
    raise notice '=== TESTE 8: tentar mudar a empresa de uma equipe existente -> esperado FALHA ===';
end $$;

update public.teams set company_id = '00000000-0000-0000-0000-0000000000b1'
where id = '00000000-0000-0000-0000-0000000030a1';

do $$
begin
    raise notice '=== TESTE 9 (simetria): Gerente B vincula Membro B a Equipe B -> esperado SUCESSO ===';
end $$;

begin;
set local app.test_uid = '00000000-0000-0000-0000-0000000020b1';
set local role authenticated;
insert into public.team_memberships (team_id, user_profile_id, membership_role)
values ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000010b2', 'supervisor');
commit;

do $$
begin
    raise notice '=== FIM DA SUITE — confira acima: testes 1 e 9 devem mostrar INSERT sem erro; 2,3,4,5,7,8 devem mostrar ERROR; teste 6 deve mostrar deve_ser_zero=0 ===';
end $$;
