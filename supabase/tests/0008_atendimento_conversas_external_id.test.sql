-- Suite de aceite pra supabase/migrations/0008_atendimento_conversas_external_id.sql.
--
-- Prova que conversations.external_id garante, no PROPRIO BANCO (nao só na
-- disciplina do checkpoint local do importador), que a mesma sessão do
-- Totalk nunca vira duas conversations — mesmo que o checkpoint local seja
-- perdido e o importador rode de novo do zero.
--
-- Como rodar (precisa de 0001-0008 aplicadas na mesma base — ver cabeçalho
-- de 0004_atendimento_chat.test.sql pro passo a passo completo, aplicando
-- 0008 por cima antes deste arquivo):
--
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/migrations/0008_atendimento_conversas_external_id.sql
--   psql -d testechat -v ON_ERROR_STOP=1 -f supabase/tests/0008_atendimento_conversas_external_id.test.sql

\set ON_ERROR_STOP on

insert into public.companies (id, legal_name) values
    ('00000000-0000-0000-0000-0000000000e8', 'Empresa de teste E8 (0008)')
on conflict (id) do nothing;

insert into public.channels (id, company_id, name, provider) values
    ('00000000-0000-0000-0000-00000000e8b1', '00000000-0000-0000-0000-0000000000e8', 'Canal Totalk E8', 'totalk'),
    ('00000000-0000-0000-0000-00000000e8b2', '00000000-0000-0000-0000-0000000000e8', 'Canal Totalk E8 Juridico', 'totalk')
on conflict (id) do nothing;

insert into public.contacts (id, company_id, display_name) values
    ('00000000-0000-0000-0000-00000000e8c1', '00000000-0000-0000-0000-0000000000e8', 'Contato E8')
on conflict (id) do nothing;

\echo '=== TESTE 1 (0008): conversa com external_id novo -> esperado SUCESSO ==='
do $$
begin
    insert into public.conversations (id, company_id, channel_id, contact_id, external_id, status)
    values ('00000000-0000-0000-0000-00000000e8d1', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000e8b1', '00000000-0000-0000-0000-00000000e8c1', 'sessao-totalk-0001', 'encerrada');
    raise notice 'TESTE 1 (0008) OK';
end;
$$;

\echo '=== TESTE 2 (0008): reimportar a MESMA sessao (mesmo canal+external_id) -> esperado FALHA (unique_violation) ==='
do $$
begin
    insert into public.conversations (id, company_id, channel_id, contact_id, external_id, status)
    values ('00000000-0000-0000-0000-00000000e8d2', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000e8b1', '00000000-0000-0000-0000-00000000e8c1', 'sessao-totalk-0001', 'encerrada');
    raise exception 'TESTE 2 (0008) FALHOU: segunda conversa com mesmo canal+external_id deveria ter sido bloqueada';
exception
    when unique_violation then
        raise notice 'TESTE 2 (0008) OK: bloqueado por unique_violation (SQLSTATE %) — protecao no banco, independente do checkpoint local', sqlstate;
end;
$$;

\echo '=== TESTE 3 (0008): duas conversas com external_id NULL no mesmo canal (webhook/simulado) -> esperado SUCESSO nas duas ==='
do $$
begin
    insert into public.conversations (id, company_id, channel_id, contact_id, status)
    values ('00000000-0000-0000-0000-00000000e8d3', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000e8b1', '00000000-0000-0000-0000-00000000e8c1', 'humano');

    insert into public.conversations (id, company_id, channel_id, contact_id, status)
    values ('00000000-0000-0000-0000-00000000e8d4', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000e8b1', '00000000-0000-0000-0000-00000000e8c1', 'humano');

    raise notice 'TESTE 3 (0008) OK: indice parcial (where external_id is not null) nao afeta conversas sem external_id';
end;
$$;

\echo '=== TESTE 4 (0008): mesmo external_id em CANAL DIFERENTE -> esperado SUCESSO (escopo e por canal) ==='
do $$
begin
    insert into public.conversations (id, company_id, channel_id, contact_id, external_id, status)
    values ('00000000-0000-0000-0000-00000000e8d5', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-00000000e8b2', '00000000-0000-0000-0000-00000000e8c1', 'sessao-totalk-0001', 'encerrada');
    raise notice 'TESTE 4 (0008) OK: mesmo external_id em canal diferente nao colide';
end;
$$;

\echo '=== TODOS OS 4 TESTES DE 0008 PASSARAM ==='
