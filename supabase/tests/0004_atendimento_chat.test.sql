-- Suite de aceite pra supabase/migrations/0004_atendimento_chat.sql.
-- Mesmo padrao automatizado de 0002/0003 (SQLSTATE checado em bloco DO,
-- ON_ERROR_STOP=1, sem inspecao manual de log) + contagem de linhas pra
-- casos de SELECT (RLS filtra silenciosamente, nao lanca erro).
--
-- Como rodar (precisa de 0001+0002+0003+0004 ja aplicadas na mesma base,
-- por cima de fixture-base.sql + fixture-clients-stub.sql):
--
--   createdb testechat
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/fixture-base.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/fixture-clients-stub.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0001_equipes.sql
--   psql -d testechat -c "grant select, insert, update, delete on public.teams, public.team_memberships to authenticated, service_role;"
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0002_equipes_integridade_empresa.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0003_equipes_integridade_transferencia_empresa.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0004_atendimento_chat.sql
--   psql -d testechat -c "grant select, insert, update, delete on public.channels, public.contacts, public.contact_phone_numbers, public.conversations, public.conversation_transfers, public.messages, public.message_attachments, public.inbound_events, public.outbound_jobs to authenticated, service_role;"
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/0004_atendimento_chat.test.sql
--   echo "exit code: $?"
--   dropdb testechat

\set ON_ERROR_STOP on

-- Cenario: 2 empresas. Empresa A tem admin, supervisor (Ana) e consultor
-- (Bruno) numa equipe; Empresa B tem admin, supervisor e consultor numa
-- outra equipe. 1 canal e 1 contato por empresa. 2 conversas na empresa A:
-- uma atribuida ao Bruno, outra sem responsavel (na fila da equipe).

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000e1', 'Empresa de teste E (chat)'),
    ('00000000-0000-0000-0000-0000000000f1', 'Empresa de teste F (chat)')
on conflict (id) do nothing;

insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
    ('00000000-0000-0000-0000-0000000040e1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000050e1', 'Admin E', 'admine@teste', 'admine', 'admin', true),
    ('00000000-0000-0000-0000-0000000040e2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000050e2', 'Ana Supervisora E', 'anae@teste', 'anae', 'seller', true),
    ('00000000-0000-0000-0000-0000000040e3', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000050e3', 'Bruno Consultor E', 'brunoe@teste', 'brunoe', 'seller', true),
    ('00000000-0000-0000-0000-0000000040f1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000050f1', 'Admin F', 'adminf@teste', 'adminf', 'admin', true),
    ('00000000-0000-0000-0000-0000000040f2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000050f2', 'Consultor F', 'consultorf@teste', 'consultorf', 'seller', true)
on conflict (id) do nothing;

insert into public.teams (id, company_id, name) values
    ('00000000-0000-0000-0000-0000000060e1', '00000000-0000-0000-0000-0000000000e1', 'Equipe Comercial E'),
    ('00000000-0000-0000-0000-0000000060f1', '00000000-0000-0000-0000-0000000000f1', 'Equipe Comercial F')
on conflict (id) do nothing;

insert into public.team_memberships (team_id, user_profile_id, membership_role) values
    ('00000000-0000-0000-0000-0000000060e1', '00000000-0000-0000-0000-0000000040e2', 'supervisor'),
    ('00000000-0000-0000-0000-0000000060e1', '00000000-0000-0000-0000-0000000040e3', 'member'),
    ('00000000-0000-0000-0000-0000000060f1', '00000000-0000-0000-0000-0000000040f2', 'member')
on conflict (team_id, user_profile_id) do nothing;

insert into public.channels (id, company_id, name, provider) values
    ('00000000-0000-0000-0000-0000000070e1', '00000000-0000-0000-0000-0000000000e1', 'WhatsApp Comercial E', 'simulado'),
    ('00000000-0000-0000-0000-0000000070f1', '00000000-0000-0000-0000-0000000000f1', 'WhatsApp Comercial F', 'simulado')
on conflict (id) do nothing;

insert into public.contacts (id, company_id, display_name) values
    ('00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000000e1', 'Contato E'),
    ('00000000-0000-0000-0000-0000000080f1', '00000000-0000-0000-0000-0000000000f1', 'Contato F')
on conflict (id) do nothing;

-- Conversa 1 (E): atribuida ao Bruno.
insert into public.conversations (id, company_id, channel_id, contact_id, team_id, assigned_user_profile_id, status) values
    ('00000000-0000-0000-0000-0000000090e1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000070e1', '00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000060e1', '00000000-0000-0000-0000-0000000040e3', 'humano')
on conflict (id) do nothing;

-- Conversa 2 (E): sem responsavel, na fila da equipe.
insert into public.conversations (id, company_id, channel_id, contact_id, team_id, assigned_user_profile_id, status) values
    ('00000000-0000-0000-0000-0000000090e2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000070e1', '00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000060e1', null, 'aguardando_humano')
on conflict (id) do nothing;

-- Conversa 3 (F): outra empresa, atribuida ao consultor F.
insert into public.conversations (id, company_id, channel_id, contact_id, team_id, assigned_user_profile_id, status) values
    ('00000000-0000-0000-0000-0000000090f1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000070f1', '00000000-0000-0000-0000-0000000080f1', '00000000-0000-0000-0000-0000000060f1', '00000000-0000-0000-0000-0000000040f2', 'humano')
on conflict (id) do nothing;

\echo '=== TESTE 1: Bruno (consultor E) ve a propria conversa atribuida -> esperado 1 linha ==='
do $$
declare
    v_n integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e3';
    set local role authenticated;
    select count(*) into v_n from public.conversations where id = '00000000-0000-0000-0000-0000000090e1';
    if v_n <> 1 then
        raise exception 'TESTE 1 FALHOU: esperava 1 linha visivel, achou %', v_n;
    end if;
    raise notice 'TESTE 1 OK';
end;
$$;

\echo '=== TESTE 2: Bruno ve a conversa sem responsavel da propria equipe -> esperado 1 linha ==='
do $$
declare
    v_n integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e3';
    set local role authenticated;
    select count(*) into v_n from public.conversations where id = '00000000-0000-0000-0000-0000000090e2';
    if v_n <> 1 then
        raise exception 'TESTE 2 FALHOU: esperava 1 linha visivel, achou %', v_n;
    end if;
    raise notice 'TESTE 2 OK';
end;
$$;

\echo '=== TESTE 3: Bruno (empresa E) NAO ve conversa da empresa F -> esperado 0 linhas ==='
do $$
declare
    v_n integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e3';
    set local role authenticated;
    select count(*) into v_n from public.conversations where id = '00000000-0000-0000-0000-0000000090f1';
    if v_n <> 0 then
        raise exception 'TESTE 3 FALHOU: esperava 0 linhas (isolamento entre empresas), achou %', v_n;
    end if;
    raise notice 'TESTE 3 OK';
end;
$$;

\echo '=== TESTE 4: Ana (supervisora da equipe E) ve a conversa atribuida ao Bruno -> esperado 1 linha ==='
do $$
declare
    v_n integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e2';
    set local role authenticated;
    select count(*) into v_n from public.conversations where id = '00000000-0000-0000-0000-0000000090e1';
    if v_n <> 1 then
        raise exception 'TESTE 4 FALHOU: esperava 1 linha visivel pra supervisora, achou %', v_n;
    end if;
    raise notice 'TESTE 4 OK';
end;
$$;

\echo '=== TESTE 5: Admin E ve as duas conversas da propria empresa -> esperado 2 linhas ==='
do $$
declare
    v_n integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e1';
    set local role authenticated;
    select count(*) into v_n from public.conversations where company_id = '00000000-0000-0000-0000-0000000000e1';
    if v_n <> 2 then
        raise exception 'TESTE 5 FALHOU: esperava 2 linhas visiveis pro admin, achou %', v_n;
    end if;
    raise notice 'TESTE 5 OK';
end;
$$;

\echo '=== TESTE 6: consultor F tenta transferir (UPDATE) a conversa E que nao e sua/da sua equipe -> esperado 0 linhas afetadas ==='
do $$
declare
    v_afetadas integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050f2';
    set local role authenticated;
    update public.conversations
    set assigned_user_profile_id = '00000000-0000-0000-0000-0000000040f2'
    where id = '00000000-0000-0000-0000-0000000090e2';
    get diagnostics v_afetadas = row_count;
    if v_afetadas <> 0 then
        raise exception 'TESTE 6 FALHOU: esperava 0 linhas afetadas (RLS bloqueando cross-empresa), afetou %', v_afetadas;
    end if;
    raise notice 'TESTE 6 OK: 0 linhas afetadas, transferencia indevida bloqueada';
end;
$$;

\echo '=== TESTE 7: Ana (supervisora) transfere a conversa sem responsavel pro Bruno -> esperado SUCESSO, 1 linha afetada ==='
do $$
declare
    v_afetadas integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e2';
    set local role authenticated;
    update public.conversations
    set assigned_user_profile_id = '00000000-0000-0000-0000-0000000040e3'
    where id = '00000000-0000-0000-0000-0000000090e2';
    get diagnostics v_afetadas = row_count;
    if v_afetadas <> 1 then
        raise exception 'TESTE 7 FALHOU: esperava 1 linha afetada, afetou %', v_afetadas;
    end if;
    raise notice 'TESTE 7 OK';
end;
$$;

\echo '=== TESTE 8: mensagem com author_user_profile_id de OUTRA empresa -> esperado FALHA (NS010) ==='
do $$
begin
    insert into public.messages (company_id, conversation_id, direction, author_type, author_user_profile_id, body)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', 'saida', 'humano', '00000000-0000-0000-0000-0000000040f2', 'teste');
    raise exception 'TESTE 8 FALHOU: deveria ter sido bloqueado mas teve sucesso';
exception
    when sqlstate 'NS010' then
        raise notice 'TESTE 8 OK: bloqueado (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 9: mensagem com company_id divergente da conversa -> esperado FALHA (NS012) ==='
do $$
begin
    insert into public.messages (company_id, conversation_id, direction, author_type, body)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000090e1', 'entrada', 'cliente', 'teste');
    raise exception 'TESTE 9 FALHOU: deveria ter sido bloqueado mas teve sucesso';
exception
    when sqlstate 'NS012' then
        raise notice 'TESTE 9 OK: bloqueado (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 10: Bruno grava mensagem de saida na propria conversa -> esperado SUCESSO ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050e3';
    set local role authenticated;
    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body)
    values ('00000000-0000-0000-0000-00000000a0e1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', 'saida', 'humano', '00000000-0000-0000-0000-0000000040e3', 'Ola, tudo bem?');
    raise notice 'TESTE 10 OK';
end;
$$;

\echo '=== TESTE 11: consultor F tenta gravar mensagem na conversa E -> esperado FALHA (RLS) ==='
do $$
begin
    set local app.test_uid = '00000000-0000-0000-0000-0000000050f2';
    set local role authenticated;
    insert into public.messages (company_id, conversation_id, direction, author_type, body)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', 'saida', 'humano', 'invasao');
    raise exception 'TESTE 11 FALHOU: deveria ter sido bloqueado por RLS mas teve sucesso';
exception
    when insufficient_privilege then
        raise notice 'TESTE 11 OK: bloqueado por RLS (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 12: nota interna NAO pode gerar job de envio -> esperado FALHA (NS014) ==='
do $$
declare
    v_nota_id uuid := '00000000-0000-0000-0000-00000000a0e2';
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, is_internal_note, message_type, body)
    values (v_nota_id, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', 'saida', 'humano', true, 'nota', 'Nota interna de teste');

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', v_nota_id, 'chave-teste-nota-1');

    raise exception 'TESTE 12 FALHOU: job de envio pra nota interna deveria ter sido bloqueado mas teve sucesso';
exception
    when sqlstate 'NS014' then
        raise notice 'TESTE 12 OK: bloqueado (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 13: reenviar com a MESMA idempotency_key nao duplica job -> esperado FALHA (unique_violation) ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000a0e3';
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, body)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', 'saida', 'humano', 'Mensagem com job');

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', v_msg_id, 'chave-idempotente-1');

    begin
        insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
        values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000090e1', v_msg_id, 'chave-idempotente-1');
        raise exception 'TESTE 13 FALHOU: segundo job com mesma idempotency_key deveria ter sido bloqueado mas teve sucesso';
    exception
        when unique_violation then
            raise notice 'TESTE 13 OK: bloqueado por unique_violation (SQLSTATE %)', sqlstate;
    end;
end;
$$;

\echo '=== TESTE 14: replay do mesmo evento de webhook nao duplica -> esperado FALHA (unique_violation) ==='
do $$
begin
    insert into public.inbound_events (company_id, channel_id, provider, external_event_id, payload)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000070e1', 'simulado', 'evt-teste-1', '{}'::jsonb);

    begin
        insert into public.inbound_events (company_id, channel_id, provider, external_event_id, payload)
        values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000070e1', 'simulado', 'evt-teste-1', '{}'::jsonb);
        raise exception 'TESTE 14 FALHOU: replay deveria ter sido bloqueado mas teve sucesso';
    exception
        when unique_violation then
            raise notice 'TESTE 14 OK: replay bloqueado por unique_violation (SQLSTATE %)', sqlstate;
    end;
end;
$$;

\echo '=== TESTE 15: duas tentativas concorrentes de "assumir" a mesma conversa nao-atribuida -> segunda afeta 0 linhas ==='
do $$
declare
    v_conversa_id uuid := '00000000-0000-0000-0000-0000000090e3';
    v_afetadas_1 integer;
    v_afetadas_2 integer;
begin
    insert into public.conversations (id, company_id, channel_id, contact_id, team_id, assigned_user_profile_id, status)
    values (v_conversa_id, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000070e1', '00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000060e1', null, 'aguardando_humano');

    -- Simula duas tentativas de "assumir" (claim atomico via WHERE assigned IS NULL).
    update public.conversations set assigned_user_profile_id = '00000000-0000-0000-0000-0000000040e3'
    where id = v_conversa_id and assigned_user_profile_id is null;
    get diagnostics v_afetadas_1 = row_count;

    update public.conversations set assigned_user_profile_id = '00000000-0000-0000-0000-0000000040e2'
    where id = v_conversa_id and assigned_user_profile_id is null;
    get diagnostics v_afetadas_2 = row_count;

    if v_afetadas_1 <> 1 or v_afetadas_2 <> 0 then
        raise exception 'TESTE 15 FALHOU: esperava (1,0), achou (%,%)', v_afetadas_1, v_afetadas_2;
    end if;
    raise notice 'TESTE 15 OK: primeira tentativa assumiu (1 linha), segunda nao conseguiu (0 linhas)';
end;
$$;

\echo '=== TODOS OS 15 TESTES DE 0004 PASSARAM ==='
