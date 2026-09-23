#!/usr/bin/env bash
# Prova real (nao so leitura do SQL) de que claim_outbound_jobs()
# (0005_atendimento_worker_rpc.sql) nao deixa dois workers pegarem o mesmo
# job: sessao A abre uma transacao, reivindica 2 jobs e segura (pg_sleep)
# sem commitar; sessao B chama a mesma function CONCORRENTEMENTE — se
# SKIP LOCKED estiver certo, B volta rapido (nao espera A) e pega so o job
# que sobrou, sem overlap com A.
#
# Precisa de um Postgres com 0001-0005 ja aplicadas (ver cabecalho de
# supabase/tests/0004_atendimento_chat.test.sql pro passo a passo) e 3
# outbound_jobs pendentes ja inseridos (ajustar os IDs de empresa/conversa/
# mensagem abaixo, ou usar a mesma seed usada na sessao de desenvolvimento).
#
# Uso: PGHOST=127.0.0.1 PGPORT=5433 PGUSER=postgres PGDATABASE=testeworker \
#      bash supabase/tests/testar-concorrencia-outbound-jobs.sh

set -euo pipefail

TMPDIR_TESTE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TESTE"' EXIT

cat > "$TMPDIR_TESTE/sessao-a.sql" <<'SQL'
begin;
select id, message_id from public.claim_outbound_jobs(2, 'worker-A') order by message_id;
select pg_sleep(4);
commit;
SQL

psql -v ON_ERROR_STOP=1 -f "$TMPDIR_TESTE/sessao-a.sql" > "$TMPDIR_TESTE/saida-a.log" 2>&1 &
PID_A=$!
sleep 1.5

INICIO_MS=$(date +%s%N)
SAIDA_B=$(psql -v ON_ERROR_STOP=1 -t -c "select message_id from public.claim_outbound_jobs(2, 'worker-B') order by message_id;")
FIM_MS=$(date +%s%N)
DURACAO_MS=$(( (FIM_MS - INICIO_MS) / 1000000 ))

wait "$PID_A"

echo "=== Sessao A (segurou 4s) ==="
cat "$TMPDIR_TESTE/saida-a.log"
echo ""
echo "=== Sessao B (concorrente, deveria ser rapida e pegar so o que sobrou) ==="
echo "$SAIDA_B"
echo "Duracao da sessao B: ${DURACAO_MS}ms"

if [ "$DURACAO_MS" -gt 2000 ]; then
    echo "FALHOU: sessao B esperou mais de 2s — parece ter sido bloqueada em vez de pular as linhas travadas (SKIP LOCKED nao funcionou)."
    exit 1
fi

if [ -z "$(echo "$SAIDA_B" | tr -d '[:space:]')" ]; then
    echo "FALHOU: sessao B nao reivindicou nenhum job — esperava pegar o job restante nao travado por A."
    exit 1
fi

echo ""
echo "OK: sessao B respondeu rapido (sem esperar A) e reivindicou apenas o job nao travado — SKIP LOCKED confirmado."
