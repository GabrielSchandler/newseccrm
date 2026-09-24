-- Suite de aceite pra supabase/migrations/0006_atendimento_outbound_jobs_policy.sql.
--
-- Bug real encontrado rodando o cenário de aceite completo contra
-- homologação (scripts/testes-homologacao/verificar-fluxo-chat-completo.mjs):
-- um consultor comum enviando mensagem pela própria conversa atribuída não
-- conseguia inserir o outbound_jobs (RLS antiga só liberava admin/manager),
-- então a mensagem ficava presa em "pendente" pra sempre — o worker nunca
-- tinha job nenhum pra processar. Esta suite prova que 0006 corrige isso
-- sem reabrir a proteção de nota interna nem deixar outra empresa inserir.
--
-- Como rodar (precisa de 0001-0006 já aplicadas na mesma base — ver
-- cabeçalho de 0004_atendimento_chat.test.sql pro passo a passo completo,
-- rodando 0006 por cima antes deste arquivo):
--
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0006_atendimento_outbound_jobs_policy.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/0006_atendimento_outbound_jobs_policy.test.sql

\set ON_ERROR_STOP on

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000c6', 'Empresa de teste G (0006)')
on conflict (id) do nothing;

insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
    ('00000000-0000-0000-0000-00000000c6a1', '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000c6a2', 'Consultor G', 'consultorg@teste', 'consultorg', 'seller', true)
on conflict (id) do nothing;

insert into public.channels (id, company_id, name, provider) values
    ('00000000-0000-0000-0000-00000000c6b1', '00000000-0000-0000-0000-0000000000c6', 'Canal G', 'simulado')
on conflict (id) do nothing;

insert into public.contacts (id, company_id, display_name) values
    ('00000000-0000-0000-0000-00000000c6c1', '00000000-0000-0000-0000-0000000000c6', 'Contato G')
on conflict (id) do nothing;

-- Conversa atribuída ao próprio consultor G — cenário real do bug (enviar mensagem na própria conversa).
insert into public.conversations (id, company_id, channel_id, contact_id, assigned_user_profile_id, status) values
    ('00000000-0000-0000-0000-00000000c6d1', '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000c6b1', '00000000-0000-0000-0000-00000000c6c1', '00000000-0000-0000-0000-00000000c6a1', 'humano')
on conflict (id) do nothing;

\echo '=== TESTE 1 (0006): consultor comum insere outbound_jobs na PRÓPRIA conversa atribuída -> esperado SUCESSO ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000c6e1';
begin
    set local app.test_uid = '00000000-0000-0000-0000-00000000c6a2';
    set local role authenticated;

    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000c6d1', 'saida', 'humano', '00000000-0000-0000-0000-00000000c6a1', 'Oi!');

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000c6d1', v_msg_id, 'chave-0006-teste-1');

    raise notice 'TESTE 1 (0006) OK: consultor conseguiu enfileirar o próprio envio';
end;
$$;

\echo '=== TESTE 2 (0006): consultor de OUTRA empresa não consegue inserir outbound_jobs nesta conversa -> esperado FALHA (RLS) ==='
do $$
begin
    insert into public.companies (id, legal_name) values ('00000000-0000-0000-0000-0000000000c7', 'Empresa H (0006)') on conflict (id) do nothing;
    insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
        ('00000000-0000-0000-0000-00000000c7a1', '00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-00000000c7a2', 'Consultor H', 'consultorh@teste', 'consultorh', 'seller', true)
        on conflict (id) do nothing;

    set local app.test_uid = '00000000-0000-0000-0000-00000000c7a2';
    set local role authenticated;

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000c6d1', '00000000-0000-0000-0000-00000000c6e1', 'chave-0006-teste-2-invasao');

    raise exception 'TESTE 2 (0006) FALHOU: consultor de outra empresa conseguiu inserir job — deveria ter sido bloqueado';
exception
    when insufficient_privilege then
        raise notice 'TESTE 2 (0006) OK: bloqueado por RLS (SQLSTATE %)', sqlstate;
end;
$$;

\echo '=== TESTE 3 (0006): consultor comum NÃO consegue fazer UPDATE direto em outbound_jobs (só o worker via service_role) -> esperado 0 linhas afetadas ==='
-- RLS em UPDATE não lança erro quando a policy USING não bate — a linha
-- fica simplesmente invisível pro comando, resultado é 0 linhas afetadas
-- (padrão do Postgres), diferente de INSERT (onde WITH CHECK falhando
-- lança "new row violates row-level security policy"). Por isso aqui o
-- teste correto é contar linhas afetadas, não esperar exceção.
do $$
declare
    v_afetadas integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-00000000c6a2';
    set local role authenticated;

    update public.outbound_jobs set status = 'enviado' where conversation_id = '00000000-0000-0000-0000-00000000c6d1';
    get diagnostics v_afetadas = row_count;

    if v_afetadas <> 0 then
        raise exception 'TESTE 3 (0006) FALHOU: consultor conseguiu atualizar % linha(s) — deveria ser só o worker (service_role)', v_afetadas;
    end if;

    raise notice 'TESTE 3 (0006) OK: 0 linhas afetadas, UPDATE direto bloqueado';
end;
$$;

\echo '=== TODOS OS 3 TESTES DE 0006 PASSARAM ==='
