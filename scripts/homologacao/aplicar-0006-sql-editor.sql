-- copiado de supabase/migrations/0006_atendimento_outbound_jobs_policy.sql — cole isso no SQL Editor do Supabase de homologação e rode.
-- Corrige uma lacuna real de autorização em 0004_atendimento_chat.sql,
-- encontrada rodando o cenário de aceite completo contra homologação (não
-- em teoria): a policy de outbound_jobs só liberava INSERT pra
-- admin/manager/platform-owner, tratando a tabela como "só o
-- webhook/worker mexem aqui". Só que enviarMensagemAction roda com a
-- sessão do PRÓPRIO usuário que está enviando a mensagem (não
-- service_role) — um consultor comum enviando uma resposta pela sua
-- própria conversa atribuída precisa conseguir inserir o job de envio
-- dela. A policy antiga bloqueava isso silenciosamente (RLS nega sem
-- erro alto pro client, a mensagem ficava gravada mas o job nunca era
-- criado, então o worker nunca tinha o que processar — sintoma observado:
-- mensagem presa em "pendente" pra sempre).
--
-- Correção: quem pode agir na conversa (user_can_access_conversation,
-- mesma função de 0004 — cobre atribuído, supervisor da equipe, membro da
-- fila da equipe, admin/manager, platform owner) pode inserir/ver o job
-- de envio das mensagens daquela conversa. O trigger
-- prevent_outbound_job_for_internal_note (0004) continua bloqueando nota
-- interna virar job, então essa abertura não reintroduz esse problema.
--
-- Pre-condição: 0004_atendimento_chat.sql aplicada.

drop policy if exists outbound_jobs_platform_or_admin on public.outbound_jobs;

create policy outbound_jobs_select on public.outbound_jobs
    for select
    using (public.user_can_access_conversation(conversation_id));

create policy outbound_jobs_insert on public.outbound_jobs
    for insert
    with check (public.user_can_access_conversation(conversation_id));

-- UPDATE/DELETE seguem restritos a admin/manager/platform-owner — quem
-- de fato muda status de job é o worker, via service_role (ignora RLS).
create policy outbound_jobs_update on public.outbound_jobs
    for update
    using (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    )
    with check (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    );

create policy outbound_jobs_delete on public.outbound_jobs
    for delete
    using (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    );
