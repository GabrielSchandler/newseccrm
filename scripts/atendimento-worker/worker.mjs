/**
 * Worker persistente do atendimento — poll contínuo em outbound_jobs via
 * claim_outbound_jobs() (RPC atômica, FOR UPDATE SKIP LOCKED — ver
 * supabase/migrations/0005_atendimento_worker_rpc.sql). Processo de vida
 * longa (não serverless), roda com a chave de serviço (bypassa RLS —
 * processo de backend confiável, sem contexto de sessão HTTP). Uma função
 * serverless da Vercel não pode substituir isto — precisa ficar vivo entre
 * requisições pra fazer polling.
 *
 * Lógica do provedor simulado duplicada aqui (não importada de
 * src/lib/atendimento/) de propósito: scripts/ é código Node puro (sem
 * TypeScript/bundler), enquanto src/ usa imports com alias (@/) que só o
 * Next.js resolve. Quando um provedor real (WhatsApp de teste) existir,
 * essa duplicação deixa de fazer sentido e vale revisitar (worker vira
 * TypeScript de verdade com build próprio, ou passa a chamar uma rota HTTP
 * interna que reusa o código do app).
 *
 * Uso:
 *   node scripts/atendimento-worker/worker.mjs
 *   ATENDIMENTO_WORKER_INTERVALO_MS=1000 node scripts/atendimento-worker/worker.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERVALO_MS = Number(process.env.ATENDIMENTO_WORKER_INTERVALO_MS ?? "2000");
const LOTE = Number(process.env.ATENDIMENTO_WORKER_LOTE ?? "5");
const TAXA_FALHA_SIMULADA = Number(process.env.ATENDIMENTO_SIMULADO_TAXA_FALHA ?? "0.1");
const WORKER_ID = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no .env.local.");
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

async function processarJob(job) {
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
  const { data: jobs, error } = await admin.rpc("claim_outbound_jobs", { p_limit: LOTE, p_worker_id: WORKER_ID });

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
    `[${WORKER_ID}] iniciado — poll a cada ${INTERVALO_MS}ms, lote de ${LOTE}, taxa de falha simulada ${TAXA_FALHA_SIMULADA}.`,
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

main();
