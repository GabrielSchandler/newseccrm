/**
 * Prova, contra homologação real (mesmo Supabase que o worker de verdade
 * usa — .env.local), o fail-closed de provedor descrito no cabeçalho de
 * scripts/atendimento-worker/worker.mjs: um canal configurado com um
 * provider diferente de ATENDIMENTO_PROVEDOR NUNCA é "enviado" pelo
 * adaptador simulado — vira falha definitiva, com motivo explícito, sem
 * chamar enviarSimulado() nenhuma vez.
 *
 * Chama processarJob() diretamente (importado de worker.mjs) — não inicia
 * o loop de polling (o import não dispara main(), só quando executado
 * como `node worker.mjs` diretamente).
 *
 * Uso:
 *   node scripts/testes-homologacao/verificar-worker-fail-closed.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { processarJob, PROVEDOR_CONFIGURADO } from "../atendimento-worker/worker.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no .env.local.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let falhas = 0;
function checar(condicao, descricao) {
  if (condicao) {
    console.log(`[OK] ${descricao}`);
  } else {
    console.error(`[FALHOU] ${descricao}`);
    falhas += 1;
  }
}

async function garantirEmpresa(tradeName) {
  const { data: existente } = await admin.from("companies").select("id").eq("trade_name", tradeName).maybeSingle();
  if (existente?.id) return existente.id;
  const { data, error } = await admin.from("companies").insert({ trade_name: tradeName, legal_name: tradeName }).select("id").single();
  if (error) throw new Error(`garantirEmpresa(${tradeName}): ${error.message}`);
  await admin.from("company_platform_settings").upsert({ company_id: data.id, status: "active" }, { onConflict: "company_id" });
  return data.id;
}

async function garantirCanal(companyId, name, provider) {
  const { data: existente } = await admin.from("channels").select("id").eq("company_id", companyId).eq("name", name).maybeSingle();
  if (existente?.id) {
    await admin.from("channels").update({ provider }).eq("id", existente.id);
    return existente.id;
  }
  const { data, error } = await admin.from("channels").insert({ company_id: companyId, name, provider }).select("id").single();
  if (error) throw new Error(`garantirCanal(${name}): ${error.message}`);
  return data.id;
}

async function garantirContato(companyId, displayName) {
  const { data: existente } = await admin.from("contacts").select("id").eq("company_id", companyId).eq("display_name", displayName).maybeSingle();
  if (existente?.id) return existente.id;
  const { data, error } = await admin.from("contacts").insert({ company_id: companyId, display_name: displayName }).select("id").single();
  if (error) throw new Error(`garantirContato(${displayName}): ${error.message}`);
  return data.id;
}

async function criarConversaComJobPendente({ companyId, channelId, contactId, idempotencyKey }) {
  const { data: conversa, error: erroConversa } = await admin
    .from("conversations")
    .insert({ company_id: companyId, channel_id: channelId, contact_id: contactId, status: "humano" })
    .select("id")
    .single();
  if (erroConversa) throw new Error(`criar conversa: ${erroConversa.message}`);

  const { data: mensagem, error: erroMensagem } = await admin
    .from("messages")
    .insert({
      company_id: companyId,
      conversation_id: conversa.id,
      direction: "saida",
      author_type: "humano",
      message_type: "texto",
      body: "mensagem de teste fail-closed",
      status: "pendente",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();
  if (erroMensagem) throw new Error(`criar mensagem: ${erroMensagem.message}`);

  const { data: jobCriado, error: erroJob } = await admin
    .from("outbound_jobs")
    .insert({ company_id: companyId, conversation_id: conversa.id, message_id: mensagem.id, idempotency_key: idempotencyKey })
    .select("*")
    .single();
  if (erroJob) throw new Error(`criar job: ${erroJob.message}`);

  // Reivindica o job MANUALMENTE (status="processando", locked_by próprio) antes de
  // devolver — se houver um worker de verdade rodando em paralelo contra a mesma
  // homologação, claim_outbound_jobs só pega "pendente" (ou "processando" com lease
  // vencida), então isso evita corrida entre o worker real e este script de teste.
  const { data: job, error: erroClaim } = await admin
    .from("outbound_jobs")
    .update({ status: "processando", locked_at: new Date().toISOString(), locked_by: "teste-fail-closed" })
    .eq("id", jobCriado.id)
    .select("*")
    .single();
  if (erroClaim) throw new Error(`reivindicar job pro teste: ${erroClaim.message}`);

  return { conversationId: conversa.id, messageId: mensagem.id, job };
}

async function main() {
  console.log(`ATENDIMENTO_PROVEDOR configurado neste processo: "${PROVEDOR_CONFIGURADO}"`);
  const companyId = await garantirEmpresa("Empresa Teste FailClosed (0007)");

  console.log("\n=== CENÁRIO 1: canal com provider REAL (\"whatsapp_cloud_api\"), worker configurado pra \"simulado\" -> deve recusar (fail-closed) ===");
  {
    const canalRealId = await garantirCanal(companyId, "Canal Real D7 (fail-closed)", "whatsapp_cloud_api");
    const contatoId = await garantirContato(companyId, "Contato FailClosed 1");
    const chave = `chave-failclosed-${crypto.randomUUID()}`;
    const { messageId, job } = await criarConversaComJobPendente({ companyId, channelId: canalRealId, contactId: contatoId, idempotencyKey: chave });

    await processarJob(job);

    const { data: jobDepois } = await admin.from("outbound_jobs").select("status, last_error, locked_by").eq("id", job.id).single();
    const { data: msgDepois } = await admin.from("messages").select("status, external_id, failed_reason").eq("id", messageId).single();

    checar(jobDepois?.status === "falha", `job termina em status "falha" (obtido: "${jobDepois?.status}")`);
    checar(!!jobDepois?.last_error && /provider/i.test(jobDepois.last_error), `last_error explica o motivo (obtido: "${jobDepois?.last_error}")`);
    checar(msgDepois?.status === "falha", `mensagem termina em status "falha" (obtido: "${msgDepois?.status}")`);
    checar(!msgDepois?.external_id, `mensagem NÃO recebeu external_id simulado (obtido: ${JSON.stringify(msgDepois?.external_id)})`);
    checar(!msgDepois?.external_id?.startsWith?.("sim_"), "enviarSimulado() nunca foi chamado de verdade pra este job (sem prefixo sim_)");
  }

  console.log("\n=== CENÁRIO 2 (regressão): canal com provider \"simulado\" -> continua processando normalmente ===");
  {
    const canalSimuladoId = await garantirCanal(companyId, "Canal Simulado D7 (fail-closed regressão)", "simulado");
    const contatoId = await garantirContato(companyId, "Contato FailClosed 2");
    const chave = `chave-failclosed-regressao-${crypto.randomUUID()}`;
    const { messageId, job } = await criarConversaComJobPendente({ companyId, channelId: canalSimuladoId, contactId: contatoId, idempotencyKey: chave });

    await processarJob(job);

    const { data: jobDepois } = await admin.from("outbound_jobs").select("status, last_error").eq("id", job.id).single();
    const { data: msgDepois } = await admin.from("messages").select("status, external_id").eq("id", messageId).single();

    checar(
      jobDepois?.status === "enviado" || jobDepois?.status === "pendente",
      `job segue o fluxo normal (enviado, ou pendente se caiu na taxa de falha simulada configurada) — obtido: "${jobDepois?.status}"`,
    );
    if (jobDepois?.status === "enviado") {
      checar(msgDepois?.status === "enviada" && msgDepois?.external_id?.startsWith("sim_"), "canal simulado de verdade foi processado pelo adaptador simulado (external_id sim_*)");
    } else {
      console.log(`   (job caiu na taxa de falha simulada normal — não é o fail-closed, é ATENDIMENTO_SIMULADO_TAXA_FALHA; comportamento esperado às vezes)`);
    }
  }

  console.log(`\n${falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`}`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
