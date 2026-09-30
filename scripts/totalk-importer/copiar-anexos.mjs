/**
 * Copia os ARQUIVOS das mensagens importadas do Totalk (áudio, imagem, documento, vídeo) pro
 * Storage do Supabase (bucket privado "atendimento-anexos") e registra em message_attachments.
 *
 * Por que existe (30/09/2026): o importador traz só o registro da mensagem; o arquivo continua
 * no CDN do Totalk (cdn.flw.chat). Quando o Totalk for cancelado (07/10), esses links tendem a
 * parar de funcionar — os ~49 mil áudios se perderiam. Roda SEPARADO do importar.mjs (pode rodar
 * em paralelo com ele e de novo depois que ele terminar, pra pegar o que entrou no meio tempo).
 *
 * Idempotente: só pega mensagem de mídia que ainda não tem nenhuma linha em message_attachments.
 * Upload com upsert (reenviar o mesmo arquivo não duplica). Arquivo que o Totalk não tem mais, ou
 * maior que o limite do bucket, vai pro relatório — não derruba a cópia.
 *
 * Chamadas à API do Totalk espaçadas em 1,2s (o importar.mjs usa 0,35s) — rodando os dois juntos,
 * a soma fica abaixo do limite de 1000 req/5min. Download do CDN não conta nesse limite.
 *
 * Uso:
 *   node scripts/totalk-importer/copiar-anexos.mjs --destino=homologacao --empresa-id=<uuid> [--limite-conversas=N] [--dry-run]
 *   node scripts/totalk-importer/copiar-anexos.mjs --destino=producao --empresa-id=<uuid> --confirmo-producao [--limite-conversas=N]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { criarClienteTotalk, TAMANHO_PAGINA_REAL } from "./cliente-totalk.mjs";

const BUCKET = "atendimento-anexos";
const TIPOS_MIDIA = ["audio", "imagem", "documento", "video"];
const CONCORRENCIA = 4;
const LIMITE_BYTES = 50 * 1024 * 1024;
const DIRETORIO_SCRIPT = path.dirname(fileURLToPath(import.meta.url));

const VARIAVEIS_POR_DESTINO = {
  homologacao: { url: "NEXT_PUBLIC_SUPABASE_URL", chave: "SUPABASE_SERVICE_ROLE_KEY" },
  producao: { url: "PRODUCAO_SUPABASE_URL", chave: "PRODUCAO_SUPABASE_SERVICE_ROLE_KEY" },
};

function lerArgs(argv) {
  const args = { destino: null, empresaId: null, confirmoProducao: false, dryRun: false, limiteConversas: null };
  for (const valor of argv) {
    if (valor.startsWith("--destino=")) args.destino = valor.split("=")[1];
    else if (valor.startsWith("--empresa-id=")) args.empresaId = valor.split("=")[1];
    else if (valor === "--confirmo-producao") args.confirmoProducao = true;
    else if (valor === "--dry-run") args.dryRun = true;
    else if (valor.startsWith("--limite-conversas=")) args.limiteConversas = Number.parseInt(valor.split("=")[1], 10);
  }
  if (!Object.hasOwn(VARIAVEIS_POR_DESTINO, args.destino ?? "")) throw new Error('--destino deve ser "homologacao" ou "producao".');
  if (!args.empresaId) throw new Error("--empresa-id=<uuid> é obrigatório.");
  if (args.destino === "producao" && !args.confirmoProducao) throw new Error("--destino=producao exige também --confirmo-producao.");
  return args;
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Repete em falha de rede (mesma regra do importar.mjs) — nunca em erro de negócio. */
async function comRetentativa(fn, rotulo) {
  for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
    try {
      return await fn();
    } catch (erro) {
      const deRede = erro instanceof TypeError || /fetch failed|ECONNRESET|ETIMEDOUT|network|socket/i.test(erro?.message ?? "");
      if (!deRede || tentativa === 4) throw erro;
      console.warn(`[anexos] ${rotulo}: falha de rede (${erro.message}), tentativa ${tentativa}/4.`);
      await dormir(500 * 2 ** (tentativa - 1));
    }
  }
}

/** Mensagens de mídia da empresa que ainda não têm arquivo copiado, agrupadas por conversa. */
async function mensagensPendentesPorConversa(db, empresaId) {
  const porConversa = new Map();
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await comRetentativa(
      () =>
        db
          .from("messages")
          .select("id, conversation_id, external_id, message_attachments(id)")
          .eq("company_id", empresaId)
          .in("message_type", TIPOS_MIDIA)
          .not("external_id", "is", null)
          .order("id")
          .range(inicio, inicio + 999),
      "listar mensagens de midia",
    );
    if (error) throw new Error(`listar mensagens de mídia: ${error.message}`);
    for (const m of data ?? []) {
      if ((m.message_attachments ?? []).length > 0) continue;
      if (!porConversa.has(m.conversation_id)) porConversa.set(m.conversation_id, []);
      porConversa.get(m.conversation_id).push({ id: m.id, externalId: m.external_id });
    }
    if (!data || data.length < 1000) break;
  }
  return porConversa;
}

function arquivosDaMensagem(mensagemTotalk) {
  const d = mensagemTotalk?.details ?? {};
  if (Array.isArray(d.files) && d.files.length > 0) return d.files;
  return d.file ? [d.file] : [];
}

function nomeSeguro(nome, indice) {
  const limpo = String(nome ?? "arquivo").normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(0, 120);
  return `${indice}-${limpo || "arquivo"}`;
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const args = lerArgs(process.argv.slice(2));
  const { url, chave } = VARIAVEIS_POR_DESTINO[args.destino];
  if (!process.env[url] || !process.env[chave]) throw new Error(`Faltam ${url}/${chave} no .env.local.`);
  const db = createClient(process.env[url], process.env[chave], { auth: { autoRefreshToken: false, persistSession: false } });

  const cliente = criarClienteTotalk({
    modoFixture: false,
    baseUrl: process.env.TOTALK_IMPORT_BASE_URL,
    token: process.env.TOTALK_IMPORT_TOKEN,
    tamanhoPagina: TAMANHO_PAGINA_REAL,
    intervaloMinimoMs: 1200,
  });

  console.log(`[anexos] Destino: ${args.destino.toUpperCase()}${args.dryRun ? " — DRY-RUN, nada será gravado" : ""}`);
  const pendentes = await mensagensPendentesPorConversa(db, args.empresaId);
  let conversas = [...pendentes.keys()];
  if (args.limiteConversas) conversas = conversas.slice(0, args.limiteConversas);
  const totalMensagens = conversas.reduce((soma, id) => soma + pendentes.get(id).length, 0);
  console.log(`[anexos] ${totalMensagens} mensagens de mídia sem arquivo, em ${conversas.length} conversas.`);

  const relatorio = { copiados: 0, bytes: 0, semArquivoNoTotalk: [], grandesDemais: [], falhasDownload: [], falhasConversa: [] };
  let feitas = 0;
  let proxima = 0;

  async function processarConversa(conversationId) {
    const { data: conversa, error } = await db.from("conversations").select("external_id, company_id").eq("id", conversationId).single();
    if (error) throw new Error(`buscar conversa ${conversationId}: ${error.message}`);
    const mensagensTotalk = await cliente.listarMensagens(conversa.external_id);
    const porId = new Map(mensagensTotalk.map((m) => [m.id, m]));

    for (const msg of pendentes.get(conversationId)) {
      const arquivos = arquivosDaMensagem(porId.get(msg.externalId));
      if (arquivos.length === 0) {
        relatorio.semArquivoNoTotalk.push(msg.externalId);
        continue;
      }
      const linhas = [];
      for (const [indice, arquivo] of arquivos.entries()) {
        const origem = arquivo.publicUrlDownload ?? arquivo.publicUrl;
        if (!origem) {
          relatorio.semArquivoNoTotalk.push(msg.externalId);
          continue;
        }
        if (arquivo.size && arquivo.size > LIMITE_BYTES) {
          relatorio.grandesDemais.push({ mensagem: msg.externalId, bytes: arquivo.size });
          continue;
        }
        let conteudo;
        try {
          conteudo = await comRetentativa(async () => {
            const resposta = await fetch(origem);
            if (!resposta.ok) throw Object.assign(new Error(`HTTP ${resposta.status}`), { http: resposta.status });
            return Buffer.from(await resposta.arrayBuffer());
          }, `download ${msg.externalId}`);
        } catch (erro) {
          relatorio.falhasDownload.push({ mensagem: msg.externalId, erro: erro.message });
          continue;
        }
        const caminho = `${conversa.company_id}/${conversationId}/${msg.id}/${nomeSeguro(arquivo.name ? `${arquivo.name}` : null, indice)}`;
        if (!args.dryRun) {
          // O Storage devolve erro passageiro ("Bad Gateway", erro sem mensagem) como objeto, não
          // como exceção — transforma em exceção pra comRetentativa repetir (5 arquivos ficaram de
          // fora na 1ª passada em produção, 30/09/2026, por isso).
          const { error: erroUpload } = await comRetentativa(async () => {
            const resultado = await db.storage
              .from(BUCKET)
              .upload(caminho, conteudo, { contentType: arquivo.mimeType ?? "application/octet-stream", upsert: true });
            const mensagem = resultado.error?.message ?? "";
            if (resultado.error && (!mensagem || mensagem === "<none>" || /gateway|timeout|temporar|unavailable|5\d\d/i.test(mensagem))) {
              throw new TypeError(`storage passageiro: ${mensagem || "sem mensagem"}`);
            }
            return resultado;
          }, `upload ${msg.externalId}`);
          if (erroUpload) {
            if (/exceeded|too large|size/i.test(erroUpload.message)) {
              relatorio.grandesDemais.push({ mensagem: msg.externalId, bytes: conteudo.length });
              continue;
            }
            throw new Error(`upload ${caminho}: ${erroUpload.message}`);
          }
        }
        linhas.push({
          message_id: msg.id,
          company_id: conversa.company_id,
          storage_path: caminho,
          content_type: arquivo.mimeType ?? null,
          file_name: arquivo.name ?? null,
          size_bytes: conteudo.length,
        });
        relatorio.bytes += conteudo.length;
      }
      if (linhas.length > 0 && !args.dryRun) {
        const { error: erroInsert } = await comRetentativa(() => db.from("message_attachments").insert(linhas), `registrar ${msg.externalId}`);
        if (erroInsert) throw new Error(`registrar anexos de ${msg.externalId}: ${erroInsert.message}`);
      }
      relatorio.copiados += linhas.length;
    }
  }

  async function trabalhador() {
    while (proxima < conversas.length) {
      const id = conversas[proxima];
      proxima += 1;
      // Erro numa conversa (ex: Totalk devolve 500 pra uma sessão) não para a cópia inteira —
      // vai pro relatório, e como ela continua sem anexo, a próxima rodada tenta de novo.
      try {
        await processarConversa(id);
      } catch (erro) {
        relatorio.falhasConversa.push({ conversa: id, erro: erro.message });
        console.warn(`[anexos] conversa ${id} pulada: ${erro.message}`);
      }
      feitas += 1;
      if (feitas % 50 === 0 || feitas === conversas.length) {
        const pct = Math.round((feitas / conversas.length) * 100);
        console.log(
          `[anexos] progresso: ${feitas}/${conversas.length} conversas (${pct}%) — ${relatorio.copiados} arquivos, ${(relatorio.bytes / 1024 / 1024).toFixed(0)} MB`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCORRENCIA }, () => trabalhador()));

  const pastaSaida = path.join(DIRETORIO_SCRIPT, "saida");
  await mkdir(pastaSaida, { recursive: true });
  await writeFile(path.join(pastaSaida, "relatorio-anexos.json"), JSON.stringify(relatorio, null, 2), "utf8");
  console.log(
    `[anexos] Fim: ${relatorio.copiados} arquivos copiados (${(relatorio.bytes / 1024 / 1024).toFixed(0)} MB). ` +
      `Sem arquivo no Totalk: ${relatorio.semArquivoNoTotalk.length}. Grandes demais: ${relatorio.grandesDemais.length}. ` +
      `Falha de download: ${relatorio.falhasDownload.length}. Conversas puladas por erro: ${relatorio.falhasConversa.length}. ` +
      `Detalhes em saida/relatorio-anexos.json`,
  );
}

main().catch((erro) => {
  console.error("[anexos] Cópia interrompida:", erro.message);
  process.exitCode = 1;
});
