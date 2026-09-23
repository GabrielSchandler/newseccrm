-- RPC pro worker persistente reivindicar lotes de outbound_jobs de forma
-- atomica (SELECT ... FOR UPDATE SKIP LOCKED) — o PostgREST/supabase-js nao
-- expoe essa clausula de lock diretamente via .from()/.select(), entao isso
-- precisa ser uma function chamada via .rpc(). Sem isso, dois processos de
-- worker (ou reinicios sobrepostos) poderiam pegar o mesmo job.
--
-- So o service_role pode chamar — o worker roda com a chave de servico,
-- nunca com sessao de usuario comum (é processo de backend confiavel, sem
-- contexto de requisicao HTTP/cookie).
--
-- Pre-condicao: 0004_atendimento_chat.sql aplicada.

create or replace function public.claim_outbound_jobs(p_limit integer, p_worker_id text)
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
        where status = 'pendente'
          and next_attempt_at <= now()
        order by created_at
        limit p_limit
        for update skip locked
    )
    returning *;
end;
$$;

comment on function public.claim_outbound_jobs(integer, text) is
    'Reivindica ate p_limit outbound_jobs pendentes de forma atomica (FOR UPDATE SKIP LOCKED), '
    'marcando-os "processando" e incrementando attempts. So service_role pode chamar.';

revoke all on function public.claim_outbound_jobs(integer, text) from public;
grant execute on function public.claim_outbound_jobs(integer, text) to service_role;
