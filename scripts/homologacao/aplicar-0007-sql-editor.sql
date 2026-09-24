-- copiado de supabase/migrations/0007_atendimento_confiabilidade.sql — cole isso no SQL Editor do Supabase de homologação e rode.
--
-- Fecha 3 lacunas reais de confiabilidade encontradas por revisão externa
-- em cima do que 0004-0006 entregaram (não hipotéticas — cada uma tem
-- caminho de reprodução real):
--
-- 1. enviarMensagemAction fazia dois INSERTs separados (messages, depois
--    outbound_jobs) sem transação — se o segundo falhasse por qualquer
--    motivo (RLS, rede, constraint), a mensagem ficava presa em
--    "pendente" pra sempre, sem job pra processar (foi exatamente o
--    sintoma do bug corrigido em 0006, mas a causa estrutural — dois
--    INSERTs não atômicos — continuava lá, só não se manifestava mais
--    pra esse caso específico). Corrigido com uma function SECURITY
--    INVOKER: os dois INSERTs rodam na mesma chamada de função = mesma
--    transação do ponto de vista do Postgres — se o segundo falhar, o
--    primeiro também é desfeito, nunca sobra estado órfão. RLS continua
--    valendo normalmente nos dois INSERTs (invoker roda com o papel de
--    quem chamou, não bypassa nada).
--
-- 2. reenviarMensagemFalhadaAction tentava INSERT de um outbound_jobs
--    novo pro mesmo message_id — mas outbound_jobs_message_unique
--    (0004) exige message_id único. Reenvio de mensagem com falha real
--    (não hipótese) ia bater nessa constraint e falhar. Corrigido:
--    reenviar agora é uma function própria que faz UPDATE no job
--    existente (reseta status/tentativas/idempotency_key), não INSERT
--    de outro. Roda como SECURITY DEFINER porque UPDATE de
--    outbound_jobs continua restrito a admin/manager/platform-owner por
--    padrão (0006) — a function checa autorização explicitamente
--    (user_can_access_conversation) antes de tocar em qualquer coisa,
--    então um usuário comum não ganha UPDATE livre na tabela, só esse
--    caminho estreito e controlado.
--
-- 3. claim_outbound_jobs (0005) só pegava status='pendente' — um job que
--    ficasse "processando" pra sempre (worker morreu depois do claim,
--    antes de terminar) nunca mais seria reivindicado por ninguém.
--    Corrigido: claim agora também pega jobs "processando" com lease
--    vencido (locked_at mais velho que p_lease_minutes, default 2) —
--    outro worker (ou o mesmo, reiniciado) pode retomar. attempts
--    continua incrementando a cada reivindicação, então um job que
--    trava repetidamente ainda esgota max_attempts e vira falha
--    definitiva, não fica reivindicado pra sempre.
--
-- Junto do worker (scripts/atendimento-worker/worker.mjs), essa migração
-- também passou a sustentar um fail-closed do lado do código: antes de
-- "enviar" um job, o worker confere se o provider do canal da conversa
-- bate com ATENDIMENTO_PROVEDOR — um canal com provider real vinculado
-- ao simulador por engano vira falha definitiva, nunca um "enviada" falso.
--
-- Verificado localmente (Postgres 17 descartável, 0001-0007 aplicadas do
-- zero): 37/37 testes automatizados passando (9+3+15+3+7, suites
-- 0002/0003/0004/0006/0007) + scripts/testes-homologacao/
-- verificar-worker-fail-closed.mjs rodado contra homologação de verdade.
--
-- Pré-condição: 0001-0006 já aplicadas (0001-0005 e 0006 já estão em
-- homologação, ver aplicar-0001-a-0005-sql-editor.sql e
-- aplicar-0006-sql-editor.sql).

create or replace function public.enviar_mensagem_com_job(
    p_conversation_id uuid,
    p_company_id uuid,
    p_author_user_profile_id uuid,
    p_body text,
    p_message_type text,
    p_idempotency_key text
)
returns table(message_id uuid, ja_existia boolean)
language plpgsql
-- SECURITY INVOKER (padrão) de propósito — RLS de messages e outbound_jobs
-- continua valendo normalmente pro usuário que chamou, nos dois INSERTs,
-- dentro da mesma transação.
as $$
declare
    v_message_id uuid;
begin
    insert into public.messages (company_id, conversation_id, direction, author_type, author_user_profile_id, message_type, body, status, idempotency_key)
    values (p_company_id, p_conversation_id, 'saida', 'humano', p_author_user_profile_id, p_message_type, p_body, 'pendente', p_idempotency_key)
    returning id into v_message_id;

    insert into public.outbound_jobs (company_id, conversation_id, message_id, idempotency_key)
    values (p_company_id, p_conversation_id, v_message_id, p_idempotency_key);

    return query select v_message_id, false;
exception
    when unique_violation then
        -- idempotency_key ja usado nesta conversa (duplo clique/retry) — devolve a
        -- mensagem ja existente em vez de duplicar. Se a violacao nao for essa
        -- (colisao improvavel de outra natureza), a mensagem nao vai existir com
        -- essa chave e o RAISE propaga o erro real em vez de mascarar.
        select id into v_message_id from public.messages
        where conversation_id = p_conversation_id and idempotency_key = p_idempotency_key;

        if v_message_id is null then
            raise;
        end if;

        return query select v_message_id, true;
end;
$$;

comment on function public.enviar_mensagem_com_job(uuid, uuid, uuid, text, text, text) is
    'Cria mensagem de saida + job de envio numa unica transacao — nunca deixa mensagem orfa sem job. Idempotente por (conversation_id, idempotency_key).';
grant execute on function public.enviar_mensagem_com_job(uuid, uuid, uuid, text, text, text) to authenticated;

create or replace function public.reenviar_mensagem_falhada(
    p_message_id uuid,
    p_conversation_id uuid
)
returns table(ok boolean, mensagem text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_job_id uuid;
    v_nova_chave text;
begin
    if not public.user_can_access_conversation(p_conversation_id) then
        return query select false, 'Sem acesso a esta conversa.';
        return;
    end if;

    select status into v_status from public.messages
    where id = p_message_id and conversation_id = p_conversation_id;

    if v_status is null then
        return query select false, 'Mensagem nao encontrada nesta conversa.';
        return;
    end if;

    if v_status <> 'falha' then
        return query select false, 'So e possivel reenviar mensagens com falha.';
        return;
    end if;

    v_nova_chave := gen_random_uuid()::text;

    update public.messages
    set status = 'pendente', failed_reason = null, updated_at = now()
    where id = p_message_id;

    update public.outbound_jobs
    set status = 'pendente', idempotency_key = v_nova_chave, attempts = 0,
        next_attempt_at = now(), last_error = null, locked_at = null, locked_by = null,
        updated_at = now()
    where message_id = p_message_id
    returning id into v_job_id;

    if v_job_id is null then
        -- Nao deveria acontecer (toda mensagem que chega a "falha" passou por um
        -- job antes) — nao mascarar, reportar como inconsistencia de verdade.
        return query select false, 'Job de envio nao encontrado para esta mensagem — inconsistencia de dados, avisar suporte.';
        return;
    end if;

    return query select true, 'Reenvio agendado.';
end;
$$;

comment on function public.reenviar_mensagem_falhada(uuid, uuid) is
    'Reseta mensagem+job de falha para pendente, com nova idempotency_key. UPDATE de outbound_jobs continua restrito por RLS — este e o unico caminho controlado pra um usuario comum resetar o proprio job.';
revoke all on function public.reenviar_mensagem_falhada(uuid, uuid) from public;
grant execute on function public.reenviar_mensagem_falhada(uuid, uuid) to authenticated;

-- CREATE OR REPLACE nao troca assinatura — precisa dropar a versao de 2
-- parametros primeiro, senao as duas ficam coexistindo (overload) e uma
-- chamada so com p_limit/p_worker_id fica ambigua entre as duas (a nova
-- tem default pro terceiro parametro).
drop function if exists public.claim_outbound_jobs(integer, text);

create or replace function public.claim_outbound_jobs(p_limit integer, p_worker_id text, p_lease_minutes integer default 2)
returns setof public.outbound_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    update public.outbound_jobs
    set status = 'processando',
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = attempts + 1,
        updated_at = now()
    where id in (
        select id from public.outbound_jobs
        where (
            (status = 'pendente' and next_attempt_at <= now())
            or (status = 'processando' and locked_at < now() - make_interval(mins => p_lease_minutes))
        )
        order by created_at
        limit p_limit
        for update skip locked
    )
    returning *;
end;
$$;

comment on function public.claim_outbound_jobs(integer, text, integer) is
    'Reivindica jobs pendentes OU "processando" com lease vencido (worker anterior provavelmente morreu) — evita job travado pra sempre. attempts continua contando, entao um job repetidamente travado ainda esgota max_attempts.';

revoke all on function public.claim_outbound_jobs(integer, text, integer) from public;
grant execute on function public.claim_outbound_jobs(integer, text, integer) to service_role;
