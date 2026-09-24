/**
 * Worker persistente do atendimento — poll contínuo em outbound_jobs via
 * claim_outbound_jobs() (RPC atômica, FOR UPDATE SKIP LOCKED, com
 * recuperação de job travado por lease vencida — ver
 * supabase/migrations/0005_atendimento_worker_rpc.sql e
 * 0007_atendimento_confiabilidade.sql). Processo de vida longa (não
 * serverless), roda com a chave de serviço (bypassa RLS — processo de
 * backend confiável, sem contexto de sessão HTTP). Uma função serverless da
 * Vercel não pode substituir isto — precisa ficar vivo entre requisições
 * pra fazer polling.
 *
 * Lógica do provedor simulado duplicada aqui (não importada de
 * src/lib/atendimento/) de propósito: scripts/ é código Node puro (sem
 * TypeScript/bundler), enquanto src/ usa imports com alias (@/) que só o
 * Next.js resolve. Quando um provedor real (WhatsApp de teste) existir,
 * essa duplicação deixa de fazer sentido e vale revisitar (worker vira
 * TypeScript de verdade com build próprio, ou passa a chamar uma rota HTTP
 * interna que reusa o código do app).
 *
 * Fail-closed de provedor (ver ../../src/lib/atendimento/registro-provedor.ts
 * pro equivalente do lado da aplicação): antes de "enviar" um job, o worker
 * confere a coluna channels.provider do canal da conversa. Só processa se
 * ela for exatamente igual a ATENDIMENTO_PROVEDOR — um canal com provider
 * real (ex: "whatsapp_cloud_api") cujo job caísse aqui por engano NUNCA é
 * enviado pelo simulador (isso fabricaria um "enviada" falso pro cliente).
 * Em vez disso o job e a mensagem são marcados como falha definitiva, com
 * motivo explícito, sem gastar tentativas de retry (não é um problema
 * transitório — reenviar não muda o resultado). Coberto por
 * scripts/testes-homologacao/verificar-worker-fail-closed.mjs.
 *
 * Uso:
 *   node scripts/atendimento-worker/worker.mjs
 *   ATENDIMENTO_WORKER_INTERVALO_MS=1000 node scripts/atendimento-worker/worker.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERVALO_MS = Number(process.env.ATENDIMENTO_WORKER_INTERVALO_MS ?? "2000");
const LOTE = Number(process.env.ATENDIMENTO_WORKER_LOTE ?? "5");
const LEASE_MINUTOS = Number(process.env.ATENDIMENTO_WORKER_LEASE_MINUTOS ?? "2");
const TAXA_FALHA_SIMULADA = Number(process.env.ATENDIMENTO_SIMULADO_TAXA_FALHA ?? "0.1");
const WORKER_ID = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

/** Mesmo contrato de registro-provedor.ts: só "simulado" existe hoje — qualquer outro valor quebra alto, nunca cai num fallback silencioso. */
const PROVEDORES_CONHECIDOS = new Set(["simulado"]);
const PROVEDOR_CONFIGURADO = process.env.ATENDIMENTO_PROVEDOR ?? "simulado";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no .env.local.");
}

if (!PROVEDORES_CONHECIDOS.has(PROVEDOR_CONFIGURADO)) {
  throw new Error(
    `ATENDIMENTO_PROVEDOR="${PROVEDOR_CONFIGURADO}" não implementado neste worker — só "simulado" existe até um adaptador real (WhatsApp de teste) ser integrado.`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Adaptador simulado — ver nota no topo do arquivo sobre a duplicação. */
async function enviarSimulado() {
  if (Math.random() < TAXA_FALHA_SIMULADA) {
    return { status: "falha", erro: "Falha simulada (ATENDIMENTO_SIMULADO_TAXA_FALHA)." };
  }
  return { status: "enviada", externalId: `sim_${crypto.randomUUID()}` };
}

/** Provider real do canal da conversa do job — é contra ISSO, não só contra ATENDIMENTO_PROVEDOR, que o fail-closed decide. */
async function buscarProviderDoCanal(conversationId) {
  const { data, error } = await admin
    .from("conversations")
    .select("channels(provider)")
    .eq("id", conversationId)
    .single();

  if (error) throw new Error(`Não foi possível verificar o canal da conversa ${conversationId}: ${error.message}`);
  return data?.channels?.provider ?? null;
}

async function marcarFalhaDefinitiva(job, motivo) {
  await admin
    .from("outbound_jobs")
    .update({ status: "falha", last_error: motivo, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  await admin.from("messages").update({ status: "falha", failed_reason: motivo }).eq("id", job.message_id);

  console.error(`[${WORKER_ID}] job ${job.id}: falha definitiva (fail-closed) — ${motivo}`);
}

async function processarJob(job) {
  const providerDoCanal = await buscarProviderDoCanal(job.conversation_id);

  if (providerDoCanal !== PROVEDOR_CONFIGURADO) {
    await marcarFalhaDefinitiva(
      job,
      `Canal configurado com provider="${providerDoCanal}", mas o worker roda com ATENDIMENTO_PROVEDOR="${PROVEDOR_CONFIGURADO}" — envio recusado (fail-closed) para não simular um canal real.`,
    );
    return;
  }

  const resultado = await enviarSimulado();

  if (resultado.status === "enviada") {
    await admin
      .from("messages")
      .update({ status: "enviada", external_id: resultado.externalId, sent_at: new Date().toISOString() })
      .eq("id", job.message_id);

    await admin.from("outbound_jobs").update({ status: "enviado", updated_at: new Date().toISOString() }).eq("id", job.id);

    console.log(`[${WORKER_ID}] job ${job.id} (mensagem ${job.message_id}): enviado (${resultado.externalId})`);
    return;
  }

  const tentativasEsgotadas = job.attempts >= job.max_attempts;
  const atrasoBackoffMs = Math.min(2 ** job.attempts * 1000, 60_000);

  await admin
    .from("outbound_jobs")
    .update({
      status: tentativasEsgotadas ? "falha" : "pendente",
      last_error: resultado.erro,
      next_attempt_at: new Date(Date.now() + atrasoBackoffMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await admin.from("messages").update({ status: "falha", failed_reason: resultado.erro }).eq("id", job.message_id);

  console.warn(
    `[${WORKER_ID}] job ${job.id}: falhou (tentativa ${job.attempts}/${job.max_attempts}) — ${resultado.erro}` +
      (tentativasEsgotadas ? " — tentativas esgotadas, marcado falha definitiva" : ` — nova tentativa em ${atrasoBackoffMs}ms`),
  );
}

async function cicloDeTrabalho() {
  const { data: jobs, error } = await admin.rpc("claim_outbound_jobs", {
    p_limit: LOTE,
    p_worker_id: WORKER_ID,
    p_lease_minutes: LEASE_MINUTOS,
  });

  if (error) {
    console.error(`[${WORKER_ID}] erro ao reivindicar jobs:`, error.message);
    return;
  }

  if (!jobs || jobs.length === 0) return;

  console.log(`[${WORKER_ID}] reivindicou ${jobs.length} job(s).`);
  for (const job of jobs) {
    await processarJob(job);
  }
}

async function main() {
  console.log(
    `[${WORKER_ID}] iniciado — poll a cada ${INTERVALO_MS}ms, lote de ${LOTE}, lease de ${LEASE_MINUTOS}min, provedor "${PROVEDOR_CONFIGURADO}", taxa de falha simulada ${TAXA_FALHA_SIMULADA}.`,
  );

  let encerrando = false;
  process.on("SIGINT", () => {
    encerrando = true;
  });
  process.on("SIGTERM", () => {
    encerrando = true;
  });

  while (!encerrando) {
    await cicloDeTrabalho();
    await dormir(INTERVALO_MS);
  }

  console.log(`[${WORKER_ID}] encerrado.`);
}

// Só roda o loop se executado diretamente (`node worker.mjs`) — permite importar
// processarJob/buscarProviderDoCanal num script de teste sem iniciar o polling.
// pathToFileURL (não interpolação manual) pra funcionar em Windows (barra invertida, letra de unidade).
const executadoDiretamente = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDiretamente) {
  main();
}

export { processarJob, buscarProviderDoCanal, admin, PROVEDOR_CONFIGURADO };
