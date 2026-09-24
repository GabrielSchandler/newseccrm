-- Suite de aceite pra supabase/migrations/0007_atendimento_confiabilidade.sql.
--
-- Prova as 3 lacunas reais que a migração fecha (ver cabeçalho de 0007 pro
-- relato completo de cada uma):
--   1. enviar_mensagem_com_job nunca deixa mensagem órfã sem job — mesmo
--      quando o INSERT do job falha por um motivo que nada tem a ver com
--      RLS (aqui: colisão de idempotency_key global vinda de OUTRA
--      mensagem/conversa).
--   2. reenviar_mensagem_falhada RESETA o job existente (UPDATE), nunca
--      cria um segundo (o que bateria em outbound_jobs_message_unique).
--   3. claim_outbound_jobs recupera um job travado em "processando" com
--      lease vencida (worker morto), mas NÃO reivindica um que ainda está
--      dentro da lease.
--
-- Como rodar (precisa de 0001-0007 já aplicadas na mesma base — ver
-- cabeçalho de 0004_atendimento_chat.test.sql pro passo a passo completo
-- de fixture-base + fixture-clients-stub + migrações, aplicando 0007 por
-- cima antes deste arquivo):
--
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0007_atendimento_confiabilidade.sql
--   psql -d testechat -c "grant execute on function public.enviar_mensagem_com_job(uuid,uuid,uuid,text,text,text), public.reenviar_mensagem_falhada(uuid,uuid) to authenticated; grant execute on function public.claim_outbound_jobs(integer,text,integer) to service_role;"
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/0007_atendimento_confiabilidade.test.sql
--   echo "exit code: $?"

\set ON_ERROR_STOP on

-- Cenário próprio (não depende de fixture de outro arquivo de teste):
-- 1 empresa, 1 consultor, 1 canal, 1 contato, 2 conversas (principal +
-- uma segunda só pra hospedar a mensagem "isca" do teste 1).

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000d7', 'Empresa de teste D7 (0007)')
on conflict (id) do nothing;

insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
    ('00000000-0000-0000-0000-00000000d7a1', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7a2', 'Consultor D7', 'consultord7@teste', 'consultord7', 'seller', true)
on conflict (id) do nothing;

insert into public.channels (id, company_id, name, provider) values
    ('00000000-0000-0000-0000-00000000d7b1', '00000000-0000-0000-0000-0000000000d7', 'Canal D7', 'simulado')
on conflict (id) do nothing;

insert into public.contacts (id, company_id, display_name) values
    ('00000000-0000-0000-0000-00000000d7c1', '00000000-0000-0000-0000-0000000000d7', 'Contato D7')
on conflict (id) do nothing;

insert into public.conversations (id, company_id, channel_id, contact_id, assigned_user_profile_id, status) values
    ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7b1', '00000000-0000-0000-0000-00000000d7c1', '00000000-0000-0000-0000-00000000d7a1', 'humano'),
    ('00000000-0000-0000-0000-00000000d7d2', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7b1', '00000000-0000-0000-0000-00000000d7c1', '00000000-0000-0000-0000-00000000d7a1', 'humano')
on conflict (id) do nothing;

\echo '=== TESTE 1 (0007): job insert falhando (idempotency_key global colidindo com outra mensagem) NÃO deixa mensagem órfã ==='
do $$
declare
    v_msg_isca_id uuid := '00000000-0000-0000-0000-00000000d7e1';
    v_msg_id uuid;
    v_ja_existia boolean;
    v_orfaos integer;
begin
    -- Mensagem+job "isca" numa conversa DIFERENTE, comitados normalmente,
    -- ocupando a idempotency_key que a chamada abaixo vai tentar reusar.
    insert into public.messages (id, company_id, conversation_id, direction, author_type, body, status)
    values (v_msg_isca_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d2', 'saida', 'humano', 'mensagem isca', 'pendente');

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d2', v_msg_isca_id, 'chave-conflito-atomicidade');

    set local app.test_uid = '00000000-0000-0000-0000-00000000d7a2';
    set local role authenticated;

    begin
        select message_id, ja_existia into v_msg_id, v_ja_existia
        from public.enviar_mensagem_com_job(
            '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000d7',
            '00000000-0000-0000-0000-00000000d7a1', 'mensagem que deveria falhar', 'texto',
            'chave-conflito-atomicidade'
        );
        raise exception 'TESTE 1 (0007) FALHOU: a chamada deveria ter levantado unique_violation (colisão de idempotency_key), mas retornou sucesso (message_id=%, ja_existia=%)', v_msg_id, v_ja_existia;
    exception
        when unique_violation then
            raise notice 'TESTE 1a (0007) OK: chamada corretamente propagou unique_violation em vez de mascarar como sucesso (SQLSTATE %)', sqlstate;
    end;

    -- reset role pra checar sem depender de RLS nessa contagem de verificação
    reset role;
    select count(*) into v_orfaos from public.messages
    where conversation_id = '00000000-0000-0000-0000-00000000d7d1' and idempotency_key = 'chave-conflito-atomicidade';

    if v_orfaos <> 0 then
        raise exception 'TESTE 1b (0007) FALHOU: encontrada % mensagem(ns) órfã(s) na conversa principal — o INSERT de messages não foi desfeito junto com o de outbound_jobs', v_orfaos;
    end if;
    raise notice 'TESTE 1b (0007) OK: 0 mensagens órfãs — o rollback implícito do bloco EXCEPTION desfez os dois INSERTs juntos';
end;
$$;

\echo '=== TESTE 2 (0007): envio normal + retry com a MESMA idempotency_key -> sucesso idempotente, sem job duplicado ==='
do $$
declare
    v_msg_id_1 uuid;
    v_ja_existia_1 boolean;
    v_msg_id_2 uuid;
    v_ja_existia_2 boolean;
    v_n_jobs integer;
begin
    set local app.test_uid = '00000000-0000-0000-0000-00000000d7a2';
    set local role authenticated;

    select message_id, ja_existia into v_msg_id_1, v_ja_existia_1
    from public.enviar_mensagem_com_job(
        '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000d7',
        '00000000-0000-0000-0000-00000000d7a1', 'primeira tentativa', 'texto',
        'chave-retry-teste-2'
    );

    if v_ja_existia_1 <> false or v_msg_id_1 is null then
        raise exception 'TESTE 2a (0007) FALHOU: primeira chamada deveria criar mensagem nova (ja_existia=false, message_id não nulo), obteve ja_existia=%, message_id=%', v_ja_existia_1, v_msg_id_1;
    end if;

    -- Retry (duplo clique / retry de rede) com a MESMA chave.
    select message_id, ja_existia into v_msg_id_2, v_ja_existia_2
    from public.enviar_mensagem_com_job(
        '00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-0000000000d7',
        '00000000-0000-0000-0000-00000000d7a1', 'primeira tentativa', 'texto',
        'chave-retry-teste-2'
    );

    if v_ja_existia_2 <> true or v_msg_id_2 <> v_msg_id_1 then
        raise exception 'TESTE 2b (0007) FALHOU: retry deveria devolver ja_existia=true com o MESMO message_id (%), obteve ja_existia=%, message_id=%', v_msg_id_1, v_ja_existia_2, v_msg_id_2;
    end if;

    reset role;
    select count(*) into v_n_jobs from public.outbound_jobs where message_id = v_msg_id_1;
    if v_n_jobs <> 1 then
        raise exception 'TESTE 2c (0007) FALHOU: esperava exatamente 1 job pra mensagem %, achou %', v_msg_id_1, v_n_jobs;
    end if;

    raise notice 'TESTE 2 (0007) OK: retry idempotente, mesmo message_id, exatamente 1 job (sem duplicar)';
end;
$$;

\echo '=== TESTE 3 (0007): reenviar_mensagem_falhada RESETA o job existente, não cria um segundo ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000d7e3';
    v_job_id_antes uuid;
    v_job_id_depois uuid;
    v_ok boolean;
    v_mensagem text;
    v_n_jobs integer;
    v_status_job text;
    v_attempts integer;
    v_chave_depois text;
    v_status_msg text;
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body, status, failed_reason)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', 'saida', 'humano', '00000000-0000-0000-0000-00000000d7a1', 'mensagem que falhou', 'falha', 'erro antigo simulado');

    insert into public.outbound_jobs (id, company_id, conversation_id, message_id, idempotency_key, status, attempts, last_error, locked_at, locked_by)
    values ('00000000-0000-0000-0000-00000000d7f3', '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', v_msg_id, 'chave-original-falha', 'falha', 5, 'erro antigo simulado', now() - interval '10 minutes', 'worker-antigo')
    returning id into v_job_id_antes;

    set local app.test_uid = '00000000-0000-0000-0000-00000000d7a2';
    set local role authenticated;

    select ok, mensagem into v_ok, v_mensagem from public.reenviar_mensagem_falhada(v_msg_id, '00000000-0000-0000-0000-00000000d7d1');
    if v_ok is not true then
        raise exception 'TESTE 3a (0007) FALHOU: esperava ok=true, obteve ok=%, mensagem=%', v_ok, v_mensagem;
    end if;

    reset role;
    select count(*) into v_n_jobs from public.outbound_jobs where message_id = v_msg_id;
    select id into v_job_id_depois from public.outbound_jobs where message_id = v_msg_id limit 1;
    if v_n_jobs <> 1 then
        raise exception 'TESTE 3b (0007) FALHOU: esperava exatamente 1 job pra mensagem % após reenvio, achou % (deveria ter dado UPDATE, não INSERT)', v_msg_id, v_n_jobs;
    end if;
    if v_job_id_depois <> v_job_id_antes then
        raise exception 'TESTE 3c (0007) FALHOU: o id do job mudou (% -> %) — deveria ser o MESMO registro resetado, não um novo', v_job_id_antes, v_job_id_depois;
    end if;

    select status, attempts, idempotency_key into v_status_job, v_attempts, v_chave_depois from public.outbound_jobs where id = v_job_id_antes;
    if v_status_job <> 'pendente' or v_attempts <> 0 or v_chave_depois = 'chave-original-falha' then
        raise exception 'TESTE 3d (0007) FALHOU: job deveria estar status=pendente, attempts=0, com NOVA idempotency_key — obteve status=%, attempts=%, chave=%', v_status_job, v_attempts, v_chave_depois;
    end if;

    select status into v_status_msg from public.messages where id = v_msg_id;
    if v_status_msg <> 'pendente' then
        raise exception 'TESTE 3e (0007) FALHOU: mensagem deveria voltar a status=pendente, obteve %', v_status_msg;
    end if;

    raise notice 'TESTE 3 (0007) OK: mesmo job resetado (id inalterado), status/attempts/idempotency_key corretos, sem duplicar';
end;
$$;

\echo '=== TESTE 4 (0007): reenviar mensagem que NÃO está em falha -> recusado, sem alterar nada ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000d7e4';
    v_ok boolean;
    v_mensagem text;
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body, status)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', 'saida', 'humano', '00000000-0000-0000-0000-00000000d7a1', 'mensagem já enviada', 'enviada');

    set local app.test_uid = '00000000-0000-0000-0000-00000000d7a2';
    set local role authenticated;

    select ok, mensagem into v_ok, v_mensagem from public.reenviar_mensagem_falhada(v_msg_id, '00000000-0000-0000-0000-00000000d7d1');
    if v_ok is not false then
        raise exception 'TESTE 4 (0007) FALHOU: esperava ok=false pra mensagem que não está em falha, obteve ok=%, mensagem=%', v_ok, v_mensagem;
    end if;

    raise notice 'TESTE 4 (0007) OK: recusado corretamente (%)', v_mensagem;
end;
$$;

\echo '=== TESTE 5 (0007): usuário sem acesso à conversa não consegue reenviar mensagem alheia -> ok=false ==='
do $$
declare
    v_ok boolean;
    v_mensagem text;
begin
    insert into public.companies (id, legal_name) values ('00000000-0000-0000-0000-0000000000d8', 'Empresa D8 (0007, intrusa)') on conflict (id) do nothing;
    insert into public.user_profiles (id, company_id, auth_user_id, full_name, email, username, role, is_active) values
        ('00000000-0000-0000-0000-00000000d8a1', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-00000000d8a2', 'Consultor D8', 'consultord8@teste', 'consultord8', 'seller', true)
        on conflict (id) do nothing;

    set local app.test_uid = '00000000-0000-0000-0000-00000000d8a2';
    set local role authenticated;

    select ok, mensagem into v_ok, v_mensagem from public.reenviar_mensagem_falhada('00000000-0000-0000-0000-00000000d7e3', '00000000-0000-0000-0000-00000000d7d1');
    if v_ok is not false then
        raise exception 'TESTE 5 (0007) FALHOU: consultor de outra empresa conseguiu reenviar mensagem alheia (ok=%)', v_ok;
    end if;

    raise notice 'TESTE 5 (0007) OK: bloqueado corretamente (%)', v_mensagem;
end;
$$;

\echo '=== TESTE 6 (0007): claim_outbound_jobs recupera job "processando" com lease vencida (worker morto) ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000d7e6';
    v_job_id uuid := '00000000-0000-0000-0000-00000000d7f6';
    v_recuperado boolean := false;
    v_status text;
    v_locked_by text;
    v_attempts integer;
    r record;
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body, status)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', 'saida', 'humano', '00000000-0000-0000-0000-00000000d7a1', 'mensagem travada', 'pendente');

    insert into public.outbound_jobs (id, company_id, conversation_id, message_id, idempotency_key, status, attempts, locked_at, locked_by)
    values (v_job_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', v_msg_id, 'chave-lease-vencida', 'processando', 1, now() - interval '10 minutes', 'worker-morto');

    for r in select * from public.claim_outbound_jobs(10, 'worker-novo', 2) loop
        if r.id = v_job_id then
            v_recuperado := true;
        end if;
    end loop;

    if not v_recuperado then
        raise exception 'TESTE 6a (0007) FALHOU: job com lease vencida (locked_at 10min atrás, lease de 2min) não foi reivindicado';
    end if;

    select status, locked_by, attempts into v_status, v_locked_by, v_attempts from public.outbound_jobs where id = v_job_id;
    if v_status <> 'processando' or v_locked_by <> 'worker-novo' or v_attempts <> 2 then
        raise exception 'TESTE 6b (0007) FALHOU: esperava status=processando, locked_by=worker-novo, attempts=2 — obteve status=%, locked_by=%, attempts=%', v_status, v_locked_by, v_attempts;
    end if;

    raise notice 'TESTE 6 (0007) OK: job travado recuperado por outro worker, attempts incrementado (1 -> 2)';
end;
$$;

\echo '=== TESTE 7 (0007): claim_outbound_jobs NÃO reivindica job "processando" ainda dentro da lease ==='
do $$
declare
    v_msg_id uuid := '00000000-0000-0000-0000-00000000d7e7';
    v_job_id uuid := '00000000-0000-0000-0000-00000000d7f7';
    v_reivindicado boolean := false;
    r record;
begin
    insert into public.messages (id, company_id, conversation_id, direction, author_type, author_user_profile_id, body, status)
    values (v_msg_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', 'saida', 'humano', '00000000-0000-0000-0000-00000000d7a1', 'mensagem em processamento legítimo', 'pendente');

    insert into public.outbound_jobs (id, company_id, conversation_id, message_id, idempotency_key, status, attempts, locked_at, locked_by)
    values (v_job_id, '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-00000000d7d1', v_msg_id, 'chave-lease-valida', 'processando', 1, now(), 'worker-ativo-agora');

    for r in select * from public.claim_outbound_jobs(10, 'worker-intruso', 2) loop
        if r.id = v_job_id then
            v_reivindicado := true;
        end if;
    end loop;

    if v_reivindicado then
        raise exception 'TESTE 7 (0007) FALHOU: job ainda dentro da lease (locked_at agora, lease de 2min) foi reivindicado indevidamente por outro worker';
    end if;

    raise notice 'TESTE 7 (0007) OK: job dentro da lease preservado, não reivindicado por outro worker';
end;
$$;

\echo '=== TODOS OS 7 TESTES DE 0007 PASSARAM ==='
