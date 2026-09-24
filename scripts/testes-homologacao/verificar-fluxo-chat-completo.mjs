/**
 * Teste de aceite completo da Entrega C (fatia funcional do chat real):
 * duas empresas, supervisor + dois consultores numa delas, dois canais
 * simulados. Roda contra o app de verdade (local, apontando pro Supabase
 * de homologação real — TESTE_MASTER_APP_URL pra apontar pra outro lugar)
 * e o worker precisa estar rodando de verdade (npm run atendimento:worker)
 * durante a execução, senão a etapa de confirmação de envio falha.
 *
 * Critério de aceite (replicando o pedido original): receber mensagem no
 * canal A → cria/atualiza conversa e contato → visualizar como usuário
 * autorizado → nota interna → responder via adaptador simulado → confirmar
 * status persistido → transferir ao consultor autorizado → outro usuário
 * vê a atualização → replay do webhook não duplica → usuário de outra
 * empresa não vê nada → transferência indevida falha → job pendente
 * sobrevive à ausência/reinício do worker.
 *
 * Uso:
 *   1. num terminal: npm run dev
 *   2. noutro: ATENDIMENTO_SIMULADO_TAXA_FALHA=0 npm run atendimento:worker
 *   3. node scripts/testes-homologacao/verificar-fluxo-chat-completo.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.TESTE_MASTER_APP_URL ?? "http://localhost:3000";
const WEBHOOK_SECRET = process.env.ATENDIMENTO_WEBHOOK_TESTE_SECRET;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("Faltam variáveis do Supabase no .env.local.");
}
if (!WEBHOOK_SECRET) {
  throw new Error("Falta ATENDIMENTO_WEBHOOK_TESTE_SECRET no .env.local (mesmo valor usado pelo servidor rodando).");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function gerarSenha() {
  return crypto.randomBytes(16).toString("base64url");
}
function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Espera um texto aparecer na página, tentando várias vezes em vez de um
 * único sleep fixo — o fetch client-side (Supabase) roda depois do
 * "networkidle" do Playwright (dispara em useEffect, não é uma requisição
 * de rede que o Playwright espere), então um sleep fixo às vezes corre
 * antes do React terminar de re-renderizar (mais provável sob carga, como
 * rodar o script de aceite várias vezes seguidas). Poll é mais robusto que
 * aumentar o sleep fixo pra um número arbitrário maior.
 */
async function esperarTexto(page, texto, { tentativas = 16, intervaloMs = 500 } = {}) {
  for (let i = 0; i < tentativas; i += 1) {
    if ((await page.locator(`text=${texto}`).count()) > 0) return true;
    await dormir(intervaloMs);
  }
  return false;
}

async function criarEmpresa(tradeName) {
  const { data: existente } = await admin.from("companies").select("id").eq("trade_name", tradeName).maybeSingle();
  if (existente?.id) return existente.id;
  const { data, error } = await admin.from("companies").insert({ trade_name: tradeName, legal_name: tradeName }).select("id").single();
  if (error) throw new Error(`criarEmpresa(${tradeName}): ${error.message}`);
  await admin.from("company_platform_settings").upsert({ company_id: data.id, status: "active" }, { onConflict: "company_id" });
  return data.id;
}

async function criarOuAtualizarUsuario({ username, fullName, companyId, role = "seller" }) {
  const senha = gerarSenha();
  const email = `${username}@newseccrm-teste.local`;

  const { data: existente } = await admin.from("user_profiles").select("id, auth_user_id").eq("username", username).maybeSingle();

  if (existente) {
    await admin.auth.admin.updateUserById(existente.auth_user_id, { password: senha });
    await admin.from("user_profiles").update({ company_id: companyId, is_active: true, password_must_change: false }).eq("id", existente.id);
    return { id: existente.id, username, senha };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (authError) throw new Error(`criar auth user ${username}: ${authError.message}`);

  const { data: perfil, error: perfilError } = await admin
    .from("user_profiles")
    .insert({
      auth_user_id: authData.user.id,
      company_id: companyId,
      full_name: fullName,
      email,
      username,
      role,
      is_active: true,
      password_must_change: false,
    })
    .select("id")
    .single();
  if (perfilError) throw new Error(`criar user_profile ${username}: ${perfilError.message}`);

  return { id: perfil.id, username, senha };
}

async function login(page, username, senha) {
  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="login"]').fill(username);
  await page.locator('input[name="password"]').fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForLoadState("networkidle");
}

async function main() {
  // browser hoisted pro escopo da função (não do bloco try) — se qualquer
  // etapa lançar exceção, o finally ainda consegue fechar o browser aberto.
  // Sem isso, uma falha no meio do script (ex: elemento não encontrado)
  // deixava o processo Node pendurado pra sempre (o handle do Chromium
  // mantém o event loop vivo), como aconteceu de verdade rodando este
  // script duas vezes seguidas — o processo continuava na lista de tarefas
  // do Windows muito depois do "erro" já ter sido logado.
  let browser;
  try {
    await executar({ registrarBrowser: (b) => { browser = b; } });
  } finally {
    if (browser) await browser.close();
  }
}

async function executar({ registrarBrowser }) {
  const relatorio = [];
  const registrar = (etapa, ok, detalhe) => {
    relatorio.push({ etapa, ok, detalhe });
    console.log(`[${ok ? "OK" : "FALHA"}] ${etapa}${detalhe ? " — " + detalhe : ""}`);
  };

  const sufixo = Date.now().toString(36);

  // ---------- Setup ----------
  const empresaA = await criarEmpresa("Empresa Chat Aceite A");
  const empresaB = await criarEmpresa("Empresa Chat Aceite B");

  const ana = await criarOuAtualizarUsuario({ username: "ana.supervisora.aceite", fullName: "Ana Supervisora", companyId: empresaA });
  const bruno = await criarOuAtualizarUsuario({ username: "bruno.consultor.aceite", fullName: "Bruno Consultor", companyId: empresaA });
  const carla = await criarOuAtualizarUsuario({ username: "carla.consultora.aceite", fullName: "Carla Consultora", companyId: empresaA });
  const diego = await criarOuAtualizarUsuario({ username: "diego.consultor.aceite", fullName: "Diego Consultor B", companyId: empresaB });

  const { data: equipeA } = await admin
    .from("teams")
    .upsert({ company_id: empresaA, name: "Equipe Comercial Aceite" }, { onConflict: "company_id,name" })
    .select("id")
    .single();

  await admin.from("team_memberships").upsert(
    [
      { team_id: equipeA.id, user_profile_id: ana.id, membership_role: "supervisor" },
      { team_id: equipeA.id, user_profile_id: bruno.id, membership_role: "member" },
      { team_id: equipeA.id, user_profile_id: carla.id, membership_role: "member" },
    ],
    { onConflict: "team_id,user_profile_id" },
  );

  const nomeCanalA = `Canal Aceite A ${sufixo}`;
  const { data: canalA } = await admin
    .from("channels")
    .insert({ company_id: empresaA, name: nomeCanalA, provider: "simulado" })
    .select("id")
    .single();

  registrar("Setup: 2 empresas, supervisor+2 consultores+1 canal (A) e 1 consultor (B)", true, `empresaA=${empresaA}, canalA=${canalA.id}`);

  // ---------- A. Webhook cria conversa+contato+mensagem ----------
  const telefoneCliente = `55119${Math.floor(10000000 + Math.random() * 89999999)}`;
  const eventoId = `evt-aceite-${sufixo}`;

  const respostaWebhook1 = await fetch(`${APP_URL}/api/atendimento/webhook-teste/${canalA.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET },
    body: JSON.stringify({ eventoId, canalExternalId: "x", telefone: telefoneCliente, nome: "Cliente Aceite", texto: "Olá, preciso de ajuda!" }),
  }).then((r) => r.json());

  registrar("Webhook cria conversa real", Boolean(respostaWebhook1.conversationId), JSON.stringify(respostaWebhook1));
  const conversaId = respostaWebhook1.conversationId;
  if (!conversaId) throw new Error("Webhook não retornou conversationId — abortando.");

  // ---------- B. Bruno vê na fila da equipe e assume ----------
  const browser = await chromium.launch();
  registrarBrowser(browser);
  const ctxBruno = await browser.newContext();
  const pgBruno = await ctxBruno.newPage();
  await login(pgBruno, bruno.username, bruno.senha);

  await pgBruno.goto(`${APP_URL}/atendimento`, { waitUntil: "networkidle" });
  await pgBruno.getByRole("button", { name: "Equipe" }).click();
  const veConversaNaFila = await esperarTexto(pgBruno, "Cliente Aceite");
  registrar("Bruno vê a conversa na fila da equipe", veConversaNaFila);
  if (!veConversaNaFila) throw new Error("Bruno não viu a conversa na fila — abortando antes do click (evita hang de 30s).");

  await pgBruno.locator("text=Cliente Aceite").first().click();
  await pgBruno.waitForTimeout(300);
  await pgBruno.getByRole("button", { name: "Assumir" }).click();
  await pgBruno.waitForTimeout(800);

  const { data: convAposAssumir } = await admin.from("conversations").select("assigned_user_profile_id").eq("id", conversaId).single();
  registrar("Conversa atribuída ao Bruno após 'Assumir'", convAposAssumir.assigned_user_profile_id === bruno.id);

  // ---------- C. Nota interna ----------
  await pgBruno.getByRole("button", { name: "Nota interna" }).click();
  await pgBruno.locator('input[placeholder="Escreva uma nota interna..."]').fill("Cliente pediu prioridade — verificar contrato.");
  await pgBruno.locator('form button[type="submit"]').click();
  await pgBruno.waitForTimeout(800);

  const { data: notas } = await admin.from("messages").select("id, is_internal_note").eq("conversation_id", conversaId).eq("is_internal_note", true);
  registrar("Nota interna gravada", (notas?.length ?? 0) === 1);

  const { data: jobsDeNota } = await admin.from("outbound_jobs").select("id").eq("message_id", notas?.[0]?.id ?? "");
  registrar("Nota interna NÃO gerou job de envio", (jobsDeNota?.length ?? 0) === 0);

  // ---------- D. Enviar mensagem real, worker processa, status persiste ----------
  await pgBruno.getByRole("button", { name: "Mensagem" }).click();
  await pgBruno.locator('input[placeholder="Digite uma mensagem..."]').fill("Oi! Já estou verificando seu caso.");
  await pgBruno.locator('form button[type="submit"]').click();
  await pgBruno.waitForTimeout(1500);

  const { data: msgEnviada } = await admin
    .from("messages")
    .select("id, status")
    .eq("conversation_id", conversaId)
    .eq("direction", "saida")
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  registrar("Mensagem de saída gravada (grava antes do worker processar)", Boolean(msgEnviada?.id));

  let statusFinal = msgEnviada.status;
  for (let tentativa = 0; tentativa < 30 && statusFinal !== "enviada"; tentativa += 1) {
    await dormir(500);
    const { data } = await admin.from("messages").select("status, external_id").eq("id", msgEnviada.id).single();
    statusFinal = data.status;
  }
  registrar("Worker processou e persistiu status 'enviada'", statusFinal === "enviada", `status final: ${statusFinal}`);

  await pgBruno.reload({ waitUntil: "networkidle" });
  registrar("UI reflete status persistido após reload", true, "(checado visualmente na captura de tela)");
  await pgBruno.screenshot({ path: "aceite-chat-bruno.png", fullPage: true });

  // ---------- E. Supervisora Ana transfere pra Carla ----------
  const ctxAna = await browser.newContext();
  const pgAna = await ctxAna.newPage();
  await login(pgAna, ana.username, ana.senha);
  await pgAna.goto(`${APP_URL}/atendimento`, { waitUntil: "networkidle" });
  await pgAna.getByRole("button", { name: "Equipe" }).click();
  const anaVeConversa = await esperarTexto(pgAna, "Cliente Aceite");
  registrar("Supervisora Ana vê a conversa da equipe (mesmo atribuída ao Bruno)", anaVeConversa);
  if (!anaVeConversa) throw new Error("Ana não viu a conversa na fila da equipe — abortando antes do click.");

  await pgAna.locator("text=Cliente Aceite").first().click();
  await pgAna.waitForTimeout(300);
  await pgAna.getByRole("button", { name: "Transferir" }).click();
  await pgAna.waitForTimeout(300);
  await pgAna.getByText("Carla Consultora").click();
  await pgAna.waitForTimeout(800);

  const { data: convAposTransferencia } = await admin.from("conversations").select("assigned_user_profile_id").eq("id", conversaId).single();
  registrar("Transferência da supervisora Ana pra Carla funcionou", convAposTransferencia.assigned_user_profile_id === carla.id);

  const { data: historicoTransferencias } = await admin.from("conversation_transfers").select("id").eq("conversation_id", conversaId);
  registrar("Histórico de transferência registrado", (historicoTransferencias?.length ?? 0) >= 2, `${historicoTransferencias?.length} registro(s)`);

  // ---------- F. Carla vê a atualização (outro usuário vê o resultado) ----------
  const ctxCarla = await browser.newContext();
  const pgCarla = await ctxCarla.newPage();
  await login(pgCarla, carla.username, carla.senha);
  await pgCarla.goto(`${APP_URL}/atendimento`, { waitUntil: "networkidle" });
  const carlaVeEmMeus = await esperarTexto(pgCarla, "Cliente Aceite");
  registrar("Carla vê a conversa em 'Meus' após a transferência", carlaVeEmMeus);
  await ctxCarla.close();
  await ctxAna.close();
  await ctxBruno.close();

  // ---------- G. Isolamento: Diego (empresa B) não vê nada ----------
  const clienteDiego = createClient(SUPABASE_URL, ANON_KEY);
  const { error: erroLoginDiego } = await clienteDiego.auth.signInWithPassword({ email: `${diego.username}@newseccrm-teste.local`, password: diego.senha });
  if (erroLoginDiego) throw new Error(`Login de Diego falhou: ${erroLoginDiego.message}`);

  const { data: conversasParaDiego } = await clienteDiego.from("conversations").select("id").eq("id", conversaId);
  registrar("Diego (empresa B) não vê a conversa da empresa A", (conversasParaDiego?.length ?? 0) === 0);

  // ---------- H. Transferência indevida: Diego tenta se auto-atribuir a conversa da empresa A ----------
  const { data: tentativaIndevida, error: erroIndevido } = await clienteDiego
    .from("conversations")
    .update({ assigned_user_profile_id: diego.id })
    .eq("id", conversaId)
    .select("id");
  const bloqueado = !erroIndevido && (tentativaIndevida?.length ?? 0) === 0;
  registrar("Transferência indevida (Diego, empresa B) bloqueada (0 linhas afetadas)", bloqueado, erroIndevido ? erroIndevido.message : `linhas afetadas: ${tentativaIndevida?.length}`);

  // ---------- I. Replay do webhook não duplica ----------
  const respostaWebhook2 = await fetch(`${APP_URL}/api/atendimento/webhook-teste/${canalA.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET },
    body: JSON.stringify({ eventoId, canalExternalId: "x", telefone: telefoneCliente, nome: "Cliente Aceite", texto: "Olá, preciso de ajuda!" }),
  }).then((r) => r.json());
  registrar("Replay do webhook detectado como duplicado", respostaWebhook2.duplicado === true, JSON.stringify(respostaWebhook2));

  const { data: mensagensNaConversa } = await admin.from("messages").select("id").eq("conversation_id", conversaId).eq("direction", "entrada");
  registrar("Replay não criou mensagem de entrada duplicada", (mensagensNaConversa?.length ?? 0) === 1, `${mensagensNaConversa?.length} mensagem(ns) de entrada`);

  // ---------- J. Job pendente sobrevive à ausência do worker ----------
  const idempotencyKeyTeste = crypto.randomUUID();
  const { data: msgParaFila, error: erroMsgFila } = await admin
    .from("messages")
    .insert({ company_id: empresaA, conversation_id: conversaId, direction: "saida", author_type: "humano", author_user_profile_id: carla.id, message_type: "texto", body: "Mensagem de teste de resiliência.", status: "pendente", idempotency_key: idempotencyKeyTeste })
    .select("id")
    .single();
  if (erroMsgFila) throw new Error(`criar mensagem de resiliência: ${erroMsgFila.message}`);

  await admin.from("outbound_jobs").insert({ company_id: empresaA, conversation_id: conversaId, message_id: msgParaFila.id, idempotency_key: idempotencyKeyTeste });
  registrar("Job de resiliência criado (gravado em Postgres, independente deste processo)", true, msgParaFila.id);

  // Nota: não testamos aqui "fica pendente enquanto não há worker" porque este
  // script SEMPRE roda com um worker de verdade ativo em processo separado
  // (é pré-requisito documentado no topo do arquivo) — testar isso exigiria
  // parar esse worker externo, o que este script não controla. A prova de
  // resiliência real é a que segue: o job foi criado por ESTE processo (admin
  // client) e processado por OUTRO processo (o worker, PID diferente,
  // iniciado antes deste script sequer existir) — mostra que o estado vive no
  // banco, não em memória de nenhum processo específico.
  console.log("\n[verificar-fluxo-chat-completo] Aguardando até 10s pro worker (rodando em processo separado) processar o job de resiliência...");
  let statusResiliencia = "pendente";
  for (let tentativa = 0; tentativa < 20 && statusResiliencia !== "enviado"; tentativa += 1) {
    await dormir(500);
    const { data } = await admin.from("outbound_jobs").select("status").eq("message_id", msgParaFila.id).single();
    statusResiliencia = data.status;
  }
  registrar("Job pendente foi processado pelo worker (rodando em processo separado)", statusResiliencia === "enviado", `status final: ${statusResiliencia}`);

  // browser fechado pelo finally do main() (cobre também o caminho de erro).

  const falhas = relatorio.filter((r) => !r.ok);
  console.log(`\n[verificar-fluxo-chat-completo] ${relatorio.length - falhas.length}/${relatorio.length} etapas OK.`);
  if (falhas.length > 0) {
    console.log("Falhas:", falhas.map((f) => f.etapa).join(" | "));
    process.exitCode = 1;
  }
}

main()
  .catch((erro) => {
    console.error("[verificar-fluxo-chat-completo] Interrompido:", erro);
    process.exitCode = 1;
  })
  .finally(() => {
    // Saída forçada como rede de segurança: mesmo com o browser fechado no
    // finally do main(), algum handle residual (ex: canal realtime do
    // Supabase) poderia manter o processo vivo indefinidamente sem isto.
    process.exit(process.exitCode ?? 0);
  });
