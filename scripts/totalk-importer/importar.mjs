/**
 * Importador de historico do Totalk — modo dry-run (ver README.md).
 *
 * Le contatos/sessoes/mensagens/notas (via fixtures locais por padrao, ou da
 * API real se TOTALK_IMPORT_TOKEN estiver configurado), normaliza pro
 * formato canonico do NewSec e escreve tudo em arquivos locais dentro de
 * saida/ — NAO grava em nenhuma tabela do Supabase ainda (o schema real de
 * conversa/mensagem so existe depois da Entrega C, chat humano real).
 *
 * Garantias exigidas pela especificacao (NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md,
 * secao 12), todas verificadas por este script:
 * - Importar duas vezes nao duplica (dedupe por id externo em checkpoint).
 * - Retomar lote nao reprocessa tudo (checkpoint por sessao concluida).
 * - Historico importado nao aciona IA, envio, campanha, cobranca de
 *   transcricao ou contagem de nova entrada — este script so LE e so
 *   ESCREVE ARQUIVO LOCAL, nunca chama endpoint de envio/campanha/chatbot.
 * - Diferencas de contagem e midia indisponivel ficam explicitas no
 *   relatorio de reconciliacao, nunca silenciadas.
 * - Agente/departamento legado so vira responsavel do NewSec via
 *   mapeamento-agentes.json preenchido a mao — nunca cria usuario novo
 *   sozinho.
 *
 * Uso:
 *   node scripts/totalk-importer/importar.mjs                  (fixture, continua checkpoint)
 *   node scripts/totalk-importer/importar.mjs --reiniciar       (ignora checkpoint, comeca do zero)
 *   node scripts/totalk-importer/importar.mjs --real            (usa TOTALK_IMPORT_TOKEN/BASE_URL reais)
 *   node scripts/totalk-importer/importar.mjs --falhar-apos-sessao sessao-mariana-0001   (teste de retomada)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { criarClienteTotalk } from "./cliente-totalk.mjs";

const { loadEnvConfig } = nextEnv;

const DIRETORIO_SCRIPT = path.dirname(fileURLToPath(import.meta.url));
const PASTA_FIXTURES = path.join(DIRETORIO_SCRIPT, "fixtures");
const PASTA_CHECKPOINT = path.join(DIRETORIO_SCRIPT, ".checkpoint");
const ARQUIVO_CHECKPOINT = path.join(PASTA_CHECKPOINT, "estado.json");
const PASTA_SAIDA = path.join(DIRETORIO_SCRIPT, "saida");

function parseArgs(argv) {
  const parsed = { real: false, reiniciar: false, falharAposSessao: null };

  for (const valor of argv) {
    if (valor === "--real") parsed.real = true;
    else if (valor === "--reiniciar") parsed.reiniciar = true;
    else if (valor.startsWith("--falhar-apos-sessao=")) parsed.falharAposSessao = valor.split("=")[1];
  }

  return parsed;
}

/** Sempre retorna a forma "hidratada" (Sets), que e a usada em memoria durante a execucao. */
function checkpointVazio() {
  return {
    versao: 1,
    iniciadoEm: new Date().toISOString(),
    etapasConcluidas: new Set(),
    sessoesConcluidas: new Set(),
    vistos: {
      departamento: new Set(),
      agente: new Set(),
      contato: new Set(),
      sessao: new Set(),
      mensagem: new Set(),
      nota: new Set(),
    },
  };
}

async function carregarCheckpoint(reiniciar) {
  if (reiniciar) return checkpointVazio();

  try {
    const conteudo = await readFile(ARQUIVO_CHECKPOINT, "utf8");
    const dados = JSON.parse(conteudo);
    // Reidrata os Sets a partir dos arrays salvos em JSON.
    for (const chave of Object.keys(dados.vistos)) {
      dados.vistos[chave] = new Set(dados.vistos[chave]);
    }
    dados.sessoesConcluidas = new Set(dados.sessoesConcluidas);
    dados.etapasConcluidas = new Set(dados.etapasConcluidas);
    return dados;
  } catch (erro) {
    if (erro.code === "ENOENT") return checkpointVazio();
    throw erro;
  }
}

async function salvarCheckpoint(checkpoint) {
  await mkdir(PASTA_CHECKPOINT, { recursive: true });
  const serializavel = {
    ...checkpoint,
    vistos: Object.fromEntries(Object.entries(checkpoint.vistos).map(([chave, conjunto]) => [chave, [...conjunto]])),
    sessoesConcluidas: [...checkpoint.sessoesConcluidas],
    etapasConcluidas: [...checkpoint.etapasConcluidas],
  };
  await writeFile(ARQUIVO_CHECKPOINT, JSON.stringify(serializavel, null, 2), "utf8");
}

/** Marca como "ja importado" (visto) e retorna se e novo (deve ser escrito) ou repetido (pular). */
function marcarVisto(checkpoint, tipo, idExterno) {
  if (checkpoint.vistos[tipo].has(idExterno)) return false;
  checkpoint.vistos[tipo].add(idExterno);
  return true;
}

function normalizarContato(contato) {
  return {
    idExterno: contato.id,
    nome: contato.name,
    telefone: contato.phoneNumber,
    telefoneFormatado: contato.phoneNumberFormatted,
    email: contato.email,
    instagram: contato.instagram,
    status: contato.status,
    origemImportacao: "totalk",
  };
}

function resolverResponsavel(agenteId, mapeamentoAgentes, naoMapeados) {
  if (!agenteId) return { agenteIdExterno: null, responsavelUserId: null };

  const entrada = mapeamentoAgentes.mapeamentos?.[agenteId];
  if (!entrada || !entrada.userIdNewSec) {
    naoMapeados.add(agenteId);
    return { agenteIdExterno: agenteId, responsavelUserId: null };
  }

  return { agenteIdExterno: agenteId, responsavelUserId: entrada.userIdNewSec };
}

function normalizarSessao(sessao, mapeamentoAgentes, naoMapeados) {
  const { agenteIdExterno, responsavelUserId } = resolverResponsavel(sessao.userId, mapeamentoAgentes, naoMapeados);

  return {
    idExterno: sessao.id,
    contatoIdExterno: sessao.contactId,
    canalIdExterno: sessao.channelId,
    canalTipo: sessao.channelType,
    departamentoIdExterno: sessao.departmentId,
    agenteIdExterno,
    responsavelUserId,
    status: sessao.status,
    criadoEm: sessao.createdAt,
    atualizadoEm: sessao.updatedAt,
    iniciadoEm: sessao.startAt,
    encerradoEm: sessao.endAt,
    primeiraRespostaEm: sessao.firstResponseAt,
    origemImportacao: "totalk",
  };
}

/**
 * direcao: assumido pelo nome do campo da API (FROM_HUB = originado no hub,
 * ou seja enviado pelo agente/sistema ao contato; TO_HUB = enviado pelo
 * contato ao hub). NAO confirmado contra uma chamada real — documentacao do
 * Totalk nao descreve esse valor explicitamente (ver README.md, secao
 * "Suposicoes a validar"). Revalidar no piloto antes de confiar no valor
 * pra decidir quem e "cliente" numa mensagem importada.
 */
function normalizarMensagem(mensagem, { ehNota, arquivoResolvido, fileIdAusente }) {
  const direcao = mensagem.direction === "FROM_HUB" ? "saida" : "entrada";
  let autoria;
  if (ehNota) autoria = "consultor";
  else if (direcao === "entrada") autoria = "cliente";
  else if (mensagem.origin === "BOT") autoria = "ia";
  else if (mensagem.userId) autoria = "humano";
  else autoria = "sistema";

  return {
    idExterno: mensagem.id,
    conversaIdExterno: mensagem.sessionId,
    ehNotaInterna: ehNota,
    direcao,
    autoria,
    agenteIdExterno: mensagem.userId ?? null,
    tipo: mensagem.type ?? "TEXT",
    texto: mensagem.text ?? null,
    status: mensagem.status ?? null,
    timestamp: mensagem.timestamp ?? mensagem.createdAt,
    arquivoIdExterno: mensagem.fileId ?? null,
    arquivoResolvido: arquivoResolvido ?? null,
    arquivoIndisponivel: fileIdAusente,
    origemImportacao: "totalk",
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = parseArgs(process.argv.slice(2));

  const modoFixture = !args.real;
  const cliente = criarClienteTotalk({
    modoFixture,
    baseUrl: process.env.TOTALK_IMPORT_BASE_URL,
    token: process.env.TOTALK_IMPORT_TOKEN,
    pastaFixtures: PASTA_FIXTURES,
  });

  const mapeamentoAgentes = JSON.parse(await readFile(path.join(DIRETORIO_SCRIPT, "mapeamento-agentes.json"), "utf8"));
  const naoMapeados = new Set();
  const midiaIndisponivel = [];
  const erros = [];

  const checkpoint = await carregarCheckpoint(args.reiniciar);
  const retomando = checkpoint.sessoesConcluidas.size > 0 || checkpoint.etapasConcluidas.size > 0;

  console.log(`[totalk] Modo: ${modoFixture ? "FIXTURE (sem chamada real)" : "REAL"}${args.reiniciar ? " — reiniciado do zero" : retomando ? " — retomando checkpoint anterior" : ""}`);

  await mkdir(PASTA_SAIDA, { recursive: true });

  const contatosNormalizados = [];
  const sessoesNormalizadas = [];
  const mensagensNormalizadas = [];

  const contagens = {
    departamentos: { esperado: 0, novos: 0, jaVistos: 0 },
    agentes: { esperado: 0, novos: 0, jaVistos: 0 },
    contatos: { esperado: 0, novos: 0, jaVistos: 0 },
    sessoes: { esperado: 0, novos: 0, jaVistos: 0 },
    mensagens: { esperado: 0, novos: 0, jaVistos: 0 },
    notas: { esperado: 0, novos: 0, jaVistos: 0 },
  };

  // Departamentos e agentes: so pra conferencia/relatorio (mapeamento usa
  // mapeamento-agentes.json, nao estas listas), mas contam pro dedupe geral.
  if (!checkpoint.etapasConcluidas.has("departamentos")) {
    const departamentos = await cliente.listarDepartamentos();
    contagens.departamentos.esperado = departamentos.length;
    for (const departamento of departamentos) {
      if (marcarVisto(checkpoint, "departamento", departamento.id)) contagens.departamentos.novos += 1;
      else contagens.departamentos.jaVistos += 1;
    }
    checkpoint.etapasConcluidas.add("departamentos");
  } else {
    contagens.departamentos.jaVistos = checkpoint.vistos.departamento.size;
  }

  if (!checkpoint.etapasConcluidas.has("agentes")) {
    const agentes = await cliente.listarAgentes();
    contagens.agentes.esperado = agentes.length;
    for (const agente of agentes) {
      if (marcarVisto(checkpoint, "agente", agente.id)) contagens.agentes.novos += 1;
      else contagens.agentes.jaVistos += 1;
    }
    checkpoint.etapasConcluidas.add("agentes");
  } else {
    contagens.agentes.jaVistos = checkpoint.vistos.agente.size;
  }

  if (!checkpoint.etapasConcluidas.has("contatos")) {
    const contatos = await cliente.listarContatos();
    contagens.contatos.esperado = contatos.length;
    for (const contato of contatos) {
      if (marcarVisto(checkpoint, "contato", contato.id)) {
        contagens.contatos.novos += 1;
        contatosNormalizados.push(normalizarContato(contato));
      } else {
        contagens.contatos.jaVistos += 1;
      }
    }
    checkpoint.etapasConcluidas.add("contatos");
  } else {
    contagens.contatos.jaVistos = checkpoint.vistos.contato.size;
  }

  const sessoes = await cliente.listarSessoes();
  contagens.sessoes.esperado = sessoes.length;

  for (const sessao of sessoes) {
    if (marcarVisto(checkpoint, "sessao", sessao.id)) {
      contagens.sessoes.novos += 1;
      sessoesNormalizadas.push(normalizarSessao(sessao, mapeamentoAgentes, naoMapeados));
    } else {
      contagens.sessoes.jaVistos += 1;
    }

    if (checkpoint.sessoesConcluidas.has(sessao.id)) {
      // Sessao ja totalmente processada numa rodada anterior — pula
      // mensagens/notas dela sem reprocessar (e o que garante "retomar
      // lote nao reprocessa tudo").
      continue;
    }

    try {
      const mensagens = await cliente.listarMensagens(sessao.id);
      contagens.mensagens.esperado += mensagens.length;

      for (const mensagem of mensagens) {
        if (!marcarVisto(checkpoint, "mensagem", mensagem.id)) {
          contagens.mensagens.jaVistos += 1;
          continue;
        }
        contagens.mensagens.novos += 1;

        const arquivoResolvido = mensagem.fileId ? await cliente.resolverArquivo(mensagem.fileId) : null;
        const fileIdAusente = Boolean(mensagem.fileId) && !arquivoResolvido;
        if (fileIdAusente) {
          midiaIndisponivel.push({ mensagemId: mensagem.id, sessaoId: sessao.id, arquivoId: mensagem.fileId });
        }

        mensagensNormalizadas.push(normalizarMensagem(mensagem, { ehNota: false, arquivoResolvido, fileIdAusente }));
      }

      const notas = await cliente.listarNotas(sessao.id);
      contagens.notas.esperado += notas.length;

      for (const nota of notas) {
        if (!marcarVisto(checkpoint, "nota", nota.id)) {
          contagens.notas.jaVistos += 1;
          continue;
        }
        contagens.notas.novos += 1;
        mensagensNormalizadas.push(
          normalizarMensagem(
            { ...nota, sessionId: nota.sessionId, type: "NOTE", direction: "FROM_HUB", text: nota.text },
            { ehNota: true, arquivoResolvido: null, fileIdAusente: false },
          ),
        );
      }

      checkpoint.sessoesConcluidas.add(sessao.id);

      if (args.falharAposSessao === sessao.id) {
        // Flag de teste: simula uma queda logo depois de concluir esta
        // sessao (ja marcada como concluida acima) — usado pra provar que a
        // proxima rodada retoma da sessao SEGUINTE, sem sequer refazer a
        // chamada de mensagens/notas desta (ver README).
        await salvarCheckpoint(checkpoint);
        throw new Error(`Interrupcao proposital apos a sessao ${sessao.id} (--falhar-apos-sessao).`);
      }
    } catch (erro) {
      erros.push({ etapa: `sessao ${sessao.id}`, detalhe: erro.message });
      await salvarCheckpoint(checkpoint);
      throw erro;
    }
  }

  await salvarCheckpoint(checkpoint);

  // Escreve so o delta desta rodada; rodadas anteriores ja escreveram o
  // delta delas em execucoes passadas — concatenar historico local fica a
  // cargo de quem consumir saida/ (nao e o papel deste dry-run).
  await writeFile(path.join(PASTA_SAIDA, "contatos-normalizados.json"), JSON.stringify(contatosNormalizados, null, 2), "utf8");
  await writeFile(path.join(PASTA_SAIDA, "conversas-normalizadas.json"), JSON.stringify(sessoesNormalizadas, null, 2), "utf8");
  await writeFile(path.join(PASTA_SAIDA, "mensagens-normalizadas.json"), JSON.stringify(mensagensNormalizadas, null, 2), "utf8");

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: modoFixture ? "fixture" : "real",
    retomandoCheckpointAnterior: retomando,
    contagens,
    agentesNaoMapeados: [...naoMapeados],
    midiaIndisponivel,
    erros,
  };

  await writeFile(path.join(PASTA_SAIDA, "relatorio-reconciliacao.json"), JSON.stringify(relatorio, null, 2), "utf8");
  await writeFile(path.join(PASTA_SAIDA, "relatorio-reconciliacao.md"), formatarRelatorioMarkdown(relatorio), "utf8");

  console.log("\n[totalk] Relatorio de reconciliacao:");
  console.table(
    Object.fromEntries(Object.entries(contagens).map(([recurso, valores]) => [recurso, valores])),
  );
  if (naoMapeados.size > 0) {
    console.log(`[totalk] Agentes sem mapeamento (${naoMapeados.size}): ${[...naoMapeados].join(", ")}`);
  }
  if (midiaIndisponivel.length > 0) {
    console.log(`[totalk] Midia indisponivel (${midiaIndisponivel.length}): ver saida/relatorio-reconciliacao.json`);
  }
  console.log(`[totalk] Saida completa em ${PASTA_SAIDA}`);
}

function formatarRelatorioMarkdown(relatorio) {
  const linhas = [
    "# Relatório de reconciliação — importador Totalk (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Modo: ${relatorio.modo}`,
    `Retomando checkpoint anterior: ${relatorio.retomandoCheckpointAnterior ? "sim" : "não"}`,
    "",
    "## Contagens",
    "",
    "| Recurso | Esperado (API) | Novos importados | Já vistos (pulados) |",
    "|---|---|---|---|",
  ];

  for (const [recurso, valores] of Object.entries(relatorio.contagens)) {
    linhas.push(`| ${recurso} | ${valores.esperado} | ${valores.novos} | ${valores.jaVistos} |`);
  }

  linhas.push("", "## Agentes sem mapeamento (requer ação manual em mapeamento-agentes.json)", "");
  linhas.push(
    relatorio.agentesNaoMapeados.length === 0
      ? "Nenhum."
      : relatorio.agentesNaoMapeados.map((id) => `- ${id}`).join("\n"),
  );

  linhas.push("", "## Mídia indisponível", "");
  linhas.push(
    relatorio.midiaIndisponivel.length === 0
      ? "Nenhuma."
      : relatorio.midiaIndisponivel
          .map((item) => `- mensagem ${item.mensagemId} (sessão ${item.sessaoId}): arquivo ${item.arquivoId} não resolvido`)
          .join("\n"),
  );

  linhas.push("", "## Erros", "");
  linhas.push(relatorio.erros.length === 0 ? "Nenhum." : relatorio.erros.map((e) => `- ${e.etapa}: ${e.detalhe}`).join("\n"));
  linhas.push("");

  return linhas.join("\n");
}

main().catch((erro) => {
  console.error("[totalk] Importação interrompida:", erro.message);
  process.exitCode = 1;
});
