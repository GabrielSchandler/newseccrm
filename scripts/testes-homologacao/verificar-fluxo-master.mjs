/**
 * Verificação ponta a ponta do fluxo de master/platform owner (Entrega B,
 * ver docs/PERMISSIONS.md §2.0): criar empresa → configurar módulos/limite
 * → criar usuário dentro dela → suspender → confirmar que o usuário da
 * empresa perde acesso (e que o master, que suspendeu, nunca perde).
 *
 * Roda contra o app de verdade (Vercel, homologação — TESTE_MASTER_APP_URL
 * pra apontar pra outro lugar, ex. localhost:3000 num `next dev`/`next start`
 * local) usando o Supabase real de homologação, via Playwright (browser de
 * verdade, não chamada direta de API) — os mesmos formulários que um
 * usuário real usa.
 *
 * Exige SUPABASE_SERVICE_ROLE_KEY no .env.local (só pra criar/promover o
 * usuário master de teste e pra limpar os artefatos no final — nada de
 * bypass de RLS na verificação do fluxo em si, que é sempre via UI/sessão
 * normal).
 *
 * Uso: node scripts/testes-homologacao/verificar-fluxo-master.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.TESTE_MASTER_APP_URL ?? "https://newseccrm.vercel.app";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no .env.local (ver scripts/testes-homologacao/README.md).",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_COMPANY_NAME = "Sede Master (infra de teste automatizado)";
const MASTER_USERNAME = "master.teste.automatizado";
const MASTER_EMAIL = "master.teste.automatizado@newseccrm.local";

function gerarSenha() {
  return crypto.randomBytes(16).toString("base64url");
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reconsulta algumas vezes com pequeno atraso antes de desistir — na
 * primeira rodada desta verificação, ler pelo client admin logo depois de
 * um insert feito pela Server Action (processo/conexão diferente, via
 * Vercel) às vezes não enxergava a linha na hora, mesmo a escrita já tendo
 * de fato acontecido (confirmado: a linha aparecia segundos depois). Não é
 * bug de aplicação — é o client de verificação lendo rápido demais depois
 * de uma escrita feita por outro processo.
 */
async function reconsultarAteAchar(consultaFn, { tentativas = 6, atrasoMs = 1000 } = {}) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const resultado = await consultaFn();
    if (resultado) return resultado;
    if (tentativa < tentativas) await dormir(atrasoMs);
  }
  return null;
}

async function garantirEmpresaSede() {
  const { data: existente } = await admin
    .from("companies")
    .select("id")
    .eq("trade_name", SEED_COMPANY_NAME)
    .maybeSingle();

  if (existente?.id) return existente.id;

  const { data, error } = await admin
    .from("companies")
    .insert({ trade_name: SEED_COMPANY_NAME, legal_name: SEED_COMPANY_NAME })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar empresa sede: ${error.message}`);

  await admin
    .from("company_platform_settings")
    .upsert({ company_id: data.id, status: "active" }, { onConflict: "company_id" });

  return data.id;
}

/** Cria (ou reaproveita, com senha nova) o usuário master de teste. Retorna as credenciais pra login via UI. */
async function garantirUsuarioMaster(seedCompanyId) {
  const senha = gerarSenha();

  const { data: perfilExistente } = await admin
    .from("user_profiles")
    .select("id, auth_user_id")
    .eq("username", MASTER_USERNAME)
    .maybeSingle();

  if (perfilExistente) {
    const { error } = await admin.auth.admin.updateUserById(perfilExistente.auth_user_id, { password: senha });
    if (error) throw new Error(`Falha ao resetar senha do master de teste: ${error.message}`);
    return { username: MASTER_USERNAME, senha };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: MASTER_EMAIL,
    password: senha,
    email_confirm: true,
  });
  if (authError) throw new Error(`Falha ao criar auth user do master de teste: ${authError.message}`);

  const { error: profileError } = await admin.from("user_profiles").insert({
    auth_user_id: authData.user.id,
    company_id: seedCompanyId,
    full_name: "Master Teste Automatizado",
    email: MASTER_EMAIL,
    username: MASTER_USERNAME,
    role: "admin",
    is_platform_owner: true,
    is_active: true,
    password_must_change: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Falha ao criar user_profile do master de teste: ${profileError.message}`);
  }

  return { username: MASTER_USERNAME, senha };
}

async function login(page, username, senha) {
  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="login"]').fill(username);
  await page.locator('input[name="password"]').fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForLoadState("networkidle");
}

async function main() {
  const relatorio = { etapas: [], erro: null };
  const registrar = (etapa, ok, detalhe) => {
    relatorio.etapas.push({ etapa, ok, detalhe });
    console.log(`[${ok ? "OK" : "FALHA"}] ${etapa}${detalhe ? " — " + detalhe : ""}`);
  };

  const sufixo = Date.now().toString(36);
  const nomeEmpresaTeste = `Empresa Teste Playwright ${sufixo}`;
  const usernameUsuarioTeste = `usuario.teste.${sufixo}`;
  let empresaTesteId = null;
  let usuarioTesteAuthId = null;

  const browser = await chromium.launch();

  try {
    const seedCompanyId = await garantirEmpresaSede();
    const master = await garantirUsuarioMaster(seedCompanyId);
    registrar("Preparação: empresa sede + usuário master de teste", true, master.username);

    const contextoMaster = await browser.newContext();
    const paginaMaster = await contextoMaster.newPage();

    await login(paginaMaster, master.username, master.senha);
    const urlAposLogin = paginaMaster.url();
    registrar("Login do master via UI", urlAposLogin.includes("/empresas"), urlAposLogin);

    // Criar empresa — form real de /empresas ("Nova empresa").
    await paginaMaster.goto(`${APP_URL}/empresas`, { waitUntil: "networkidle" });
    await paginaMaster.locator('#nova-empresa input[name="trade_name"]').fill(nomeEmpresaTeste);
    await paginaMaster.locator('#nova-empresa button[type="submit"]').click();
    await paginaMaster.waitForLoadState("networkidle");

    const empresaCriada = await reconsultarAteAchar(async () => {
      const { data } = await admin.from("companies").select("id").eq("trade_name", nomeEmpresaTeste).maybeSingle();
      return data?.id ? data : null;
    });
    empresaTesteId = empresaCriada?.id ?? null;
    registrar("Criar empresa via UI", Boolean(empresaTesteId), empresaTesteId ?? "não encontrada no banco");
    if (!empresaTesteId) throw new Error("Empresa de teste não foi criada — abortando.");

    // Configurar módulos/limite — form real de /empresas/{id}.
    await paginaMaster.goto(`${APP_URL}/empresas/${empresaTesteId}`, { waitUntil: "networkidle" });
    await paginaMaster.locator('input[name="storage_limit_mb"]').fill("2048");
    await paginaMaster.locator('input[name="user_license_limit"]').fill("3");
    await paginaMaster.locator('input[name="enable_client_portal"]').uncheck();
    await paginaMaster.getByRole("button", { name: "Salvar configurações" }).click();
    await paginaMaster.waitForLoadState("networkidle");

    await paginaMaster.reload({ waitUntil: "networkidle" });
    const storageSalvo = await paginaMaster.locator('input[name="storage_limit_mb"]').inputValue();
    const portalDesmarcado = !(await paginaMaster.locator('input[name="enable_client_portal"]').isChecked());
    registrar(
      "Configurar módulos/limite e persistir",
      storageSalvo === "2048" && portalDesmarcado,
      `storage_limit_mb=${storageSalvo}, enable_client_portal=${!portalDesmarcado}`,
    );

    // Acessar a empresa (seta o cookie de empresa ativa) e criar usuário nela.
    await paginaMaster.goto(`${APP_URL}/empresas/select?company=${empresaTesteId}`, { waitUntil: "networkidle" });
    await paginaMaster.goto(`${APP_URL}/usuarios/novo`, { waitUntil: "networkidle" });

    const senhaUsuarioTeste = gerarSenha();
    await paginaMaster.locator("#full_name").fill("Usuário Teste Playwright");
    await paginaMaster.locator("#username").fill(usernameUsuarioTeste);
    await paginaMaster.locator("#temporary_password").fill(senhaUsuarioTeste);
    await paginaMaster.selectOption("#business_area", "commercial");
    await paginaMaster.selectOption("#role", "seller");
    await paginaMaster.getByRole("button", { name: "Criar usuário" }).click();
    await paginaMaster.waitForLoadState("networkidle");

    const perfilUsuarioTeste = await reconsultarAteAchar(async () => {
      const { data } = await admin
        .from("user_profiles")
        .select("id, auth_user_id")
        .eq("username", usernameUsuarioTeste)
        .maybeSingle();
      return data?.id ? data : null;
    });
    usuarioTesteAuthId = perfilUsuarioTeste?.auth_user_id ?? null;
    registrar("Criar usuário dentro da empresa via UI", Boolean(usuarioTesteAuthId), usernameUsuarioTeste);
    if (!perfilUsuarioTeste) throw new Error("Usuário de teste não foi criado — abortando.");

    // Isola a próxima verificação (suspensão) da troca de senha obrigatória
    // do primeiro login — troca de senha é outro fluxo, já teste separado.
    await admin.from("user_profiles").update({ password_must_change: false }).eq("id", perfilUsuarioTeste.id);

    // Suspender a empresa — mesmo form de configurar, campo "status".
    await paginaMaster.goto(`${APP_URL}/empresas/${empresaTesteId}`, { waitUntil: "networkidle" });
    await paginaMaster.selectOption('select[name="status"]', "suspended");
    await paginaMaster.getByRole("button", { name: "Salvar configurações" }).click();
    await paginaMaster.waitForLoadState("networkidle");

    const statusSalvo = await reconsultarAteAchar(
      async () => {
        await paginaMaster.reload({ waitUntil: "networkidle" });
        const valor = await paginaMaster.locator('select[name="status"]').inputValue();
        return valor === "suspended" ? valor : null;
      },
      { tentativas: 6, atrasoMs: 1000 },
    );
    registrar("Suspender a empresa via UI e persistir", statusSalvo === "suspended", `status=${statusSalvo}`);

    // Usuário da empresa suspensa tenta logar — deve cair em /empresa-suspensa.
    const contextoUsuario = await browser.newContext();
    const paginaUsuario = await contextoUsuario.newPage();
    await login(paginaUsuario, usernameUsuarioTeste, senhaUsuarioTeste);
    const urlUsuarioBloqueado = paginaUsuario.url();
    registrar(
      "Usuário da empresa suspensa é bloqueado (redirect /empresa-suspensa)",
      urlUsuarioBloqueado.endsWith("/empresa-suspensa"),
      urlUsuarioBloqueado,
    );
    await contextoUsuario.close();

    // O master, que suspendeu, nunca perde acesso — confirma reacessando a
    // própria empresa suspensa (contexto ainda logado, cookies preservados).
    await paginaMaster.goto(`${APP_URL}/empresas/${empresaTesteId}`, { waitUntil: "networkidle" });
    const masterAindaTemAcesso = paginaMaster.url().includes(`/empresas/${empresaTesteId}`);
    registrar("Master nunca perde acesso, mesmo à empresa que ele suspendeu", masterAindaTemAcesso, paginaMaster.url());

    await contextoMaster.close();
  } catch (erro) {
    relatorio.erro = erro.message;
    console.error("[verificar-fluxo-master] Interrompido:", erro.message);
  } finally {
    await browser.close();

    // Limpa os artefatos criados NESTA rodada (não mexe na empresa sede nem no master reaproveitável).
    if (usuarioTesteAuthId) {
      try {
        await admin.auth.admin.deleteUser(usuarioTesteAuthId);
      } catch {
        // Ignorado — se falhar, o ID fica no log acima pra limpeza manual.
      }
    }
    if (empresaTesteId) {
      try {
        await admin.from("companies").delete().eq("id", empresaTesteId);
      } catch {
        // Ignorado — se falhar, o ID fica no log acima pra limpeza manual.
      }
    }
  }

  const falhas = relatorio.etapas.filter((e) => !e.ok);
  console.log(`\n[verificar-fluxo-master] ${relatorio.etapas.length - falhas.length}/${relatorio.etapas.length} etapas OK.`);
  if (falhas.length > 0 || relatorio.erro) {
    process.exitCode = 1;
  }
}

main();
