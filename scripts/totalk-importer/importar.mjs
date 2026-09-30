/**
 * Importador de historico do Totalk (ver README.md).
 *
 * Le contatos/sessoes/mensagens/notas (via fixtures locais por padrao, ou da
 * API real se TOTALK_IMPORT_TOKEN estiver configurado), normaliza pro
 * formato canonico do NewSec. Destino da escrita e um eixo SEPARADO da fonte
 * de leitura:
 * - Sem --destino (padrao, seguro): so escreve em arquivos locais dentro de
 *   saida/ — nunca toca no banco.
 * - --destino=homologacao ou --destino=producao: grava de verdade nas tabelas
 *   reais (contacts, contact_phone_numbers, conversations, messages) da
 *   empresa/canal informados via --empresa-id/--canal-id (nunca escolhidos
 *   sozinho). Cada destino le suas PROPRIAS variaveis de ambiente
 *   (homologacao: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY;
 *   producao: PRODUCAO_SUPABASE_URL/PRODUCAO_SUPABASE_SERVICE_ROLE_KEY —
 *   nomes diferentes de proposito, pra nunca escrever no banco errado por
 *   engano). --destino=producao exige tambem --confirmo-producao (trava
 *   deliberada extra, so pra producao — habilitado em 29/09/2026, decisao
 *   do Gabriel, apos o schema ja aplicado em producao).
 * - --destino=<ambiente> --dry-run: consulta o banco real pra mostrar
 *   exatamente o que SERIA gravado (contagem novo/ja existe por recurso),
 *   sem gravar nada.
 *
 * Garantias exigidas pela especificacao (NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md,
 * secao 12), todas verificadas por este script:
 * - Importar duas vezes nao duplica — dedupe por id externo, tanto no
 *   checkpoint local (rodada normal) quanto por consulta direta ao destino
 *   (contact_phone_numbers.phone_e164, conversations.external_id,
 *   messages.external_id — funciona mesmo se o checkpoint local for
 *   perdido, nao e a fonte de verdade pra dedupe com --destino).
 * - Retomar lote nao reprocessa tudo (checkpoint por sessao concluida,
 *   salvo em disco so DEPOIS que os dados da sessao estao gravados de
 *   verdade — nunca marca "concluida" antes de escrever, pra nao mascarar
 *   perda de dado numa queda no meio do processo).
 * - Historico importado nao aciona IA, envio, campanha, cobranca de
 *   transcricao ou contagem de nova entrada — mensagem historica e um
 *   INSERT direto em "messages", nunca passa por enviar_mensagem_com_job()
 *   nem cria linha em outbound_jobs.
 * - Diferencas de contagem e midia indisponivel ficam explicitas no
 *   relatorio de reconciliacao, nunca silenciadas.
 * - Agente/departamento legado so vira responsavel do NewSec via
 *   mapeamento-agentes.json preenchido a mao — nunca cria usuario novo
 *   sozinho.
 *
 * Uso:
 *   node scripts/totalk-importer/importar.mjs                                              (fixture -> arquivo local, continua checkpoint)
 *   node scripts/totalk-importer/importar.mjs --reiniciar                                   (ignora checkpoint, comeca do zero)
 *   node scripts/totalk-importer/importar.mjs --real                                        (le da API real, ainda escreve so em arquivo local)
 *   node scripts/totalk-importer/importar.mjs --destino=homologacao --empresa-id=<uuid> --canal-id=<uuid> --dry-run   (preview contra o banco real, nada gravado)
 *   node scripts/totalk-importer/importar.mjs --destino=homologacao --empresa-id=<uuid> --canal-id=<uuid>             (grava de verdade em homologacao)
 *   node scripts/totalk-importer/importar.mjs --real --destino=producao --empresa-id=<uuid> --canal-id=<uuid> --confirmo-producao --dry-run   (preview contra producao, nada gravado)
 *   node scripts/totalk-importer/importar.mjs --real --destino=producao --empresa-id=<uuid> --canal-id=<uuid> --confirmo-producao             (grava de verdade em producao)
 *   node scripts/totalk-importer/importar.mjs --falhar-apos-sessao=sessao-mariana-0001      (flag de teste — ver "Como foi testado")
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { criarClienteTotalk, TAMANHO_PAGINA_REAL } from "./cliente-totalk.mjs";

const { loadEnvConfig } = nextEnv;

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Repete uma chamada ao Supabase até 4 vezes com backoff exponencial (500ms→1s→2s)
 * quando a falha é de REDE (fetch failed / timeout / conexão caiu) — nunca quando é
 * erro de negócio (RLS, constraint, dado inválido), que deve propagar na hora.
 * Adicionado em 29/09/2026 depois de uma importação real de produção cair no meio
 * (~400/7518 sessões) por um "TypeError: fetch failed" isolado — numa rodada de
 * milhares de escritas ao longo de horas, uma falha de rede passageira é esperada,
 * não excepcional; sem isso, cada uma exige alguém notar e reiniciar manualmente.
 */
async function comRetentativaDeRede(fn, rotulo) {
  const MAX_TENTATIVAS = 4;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      return await fn();
    } catch (erro) {
      const ehErroDeRede =
        erro instanceof TypeError || /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(erro?.message ?? "");
      if (!ehErroDeRede || tentativa === MAX_TENTATIVAS) throw erro;
      const atrasoMs = 500 * 2 ** (tentativa - 1);
      console.warn(`[totalk] ${rotulo}: falha de rede (${erro.message}), tentativa ${tentativa}/${MAX_TENTATIVAS} — aguardando ${atrasoMs}ms.`);
      await dormir(atrasoMs);
    }
  }
}

const DIRETORIO_SCRIPT = path.dirname(fileURLToPath(import.meta.url));
const PASTA_FIXTURES = path.join(DIRETORIO_SCRIPT, "fixtures");
const PASTA_CHECKPOINT = path.join(DIRETORIO_SCRIPT, ".checkpoint");
const ARQUIVO_CHECKPOINT = path.join(PASTA_CHECKPOINT, "estado.json");
const PASTA_SAIDA = path.join(DIRETORIO_SCRIPT, "saida");

function parseArgs(argv) {
  const parsed = {
    real: false,
    reiniciar: false,
    falharAposSessao: null,
    destino: null,
    dryRun: false,
    empresaId: null,
    canalId: null,
    limiteSessoes: null,
    confirmoProducao: false,
  };

  for (const valor of argv) {
    if (valor.startsWith("--limite-sessoes=")) {
      const limite = Number.parseInt(valor.split("=")[1], 10);
      if (!Number.isInteger(limite) || limite <= 0) throw new Error(`--limite-sessoes deve ser um inteiro positivo, recebi "${valor.split("=")[1]}".`);
      parsed.limiteSessoes = limite;
    } else if (valor === "--real") parsed.real = true;
    else if (valor === "--reiniciar") parsed.reiniciar = true;
    else if (valor === "--dry-run") parsed.dryRun = true;
    else if (valor === "--confirmo-producao") parsed.confirmoProducao = true;
    else if (valor.startsWith("--falhar-apos-sessao=")) parsed.falharAposSessao = valor.split("=")[1];
    else if (valor.startsWith("--destino=")) parsed.destino = valor.split("=")[1];
    else if (valor.startsWith("--empresa-id=")) parsed.empresaId = valor.split("=")[1];
    else if (valor.startsWith("--canal-id=")) parsed.canalId = valor.split("=")[1];
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

/**
 * Telefone so com digitos e DDI 55 (mesma regra de normalizeTotalkPhone em
 * src/lib/totalk/api.ts, que ja e a convencao das fixtures e do CRM). A API
 * real devolve o numero como "+55|11999999999" (com "|"), a fixture como
 * "5511999999999" — ambos convergem pra "5511999999999". Sem digitos = null.
 */
function normalizarTelefone(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) return digitos;
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

function normalizarContato(contato) {
  return {
    idExterno: contato.id,
    nome: contato.name,
    telefone: normalizarTelefone(contato.phoneNumber),
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
    naoLidas: sessao.unreadCount ?? 0,
    origemImportacao: "totalk",
  };
}

/**
 * direcao: FROM_HUB = o contato mandou pro hub ("entrada"); TO_HUB = o hub
 * (agente/IA/sistema) mandou pro contato ("saida"). CORRIGIDO em 28/09/2026 —
 * a primeira suposição (FROM_HUB="saida") estava ao contrário; foi escrita
 * por evidência indireta (tipo de mensagem, status de falha) sem cruzar com o
 * TEXTO de uma conversa real. Confirmado desta vez contra uma sessão real
 * inteira (Gean Maycon, empresa GRS Soluções), lendo o conteúdo: a primeira
 * mensagem da sessão ("Olá! Vim pelo site da GRS...", claramente o cliente
 * chegando) tem direction=FROM_HUB; a resposta ("Olá! Tudo bem? Sou a Ana...",
 * claramente a agente) tem direction=TO_HUB, origin=BOT. O erro anterior
 * inverteu toda conversa importada em homologação — corrigido no código e nas
 * 3 fixtures de mensagem (mariana/rafael/clara), que também tinham o valor
 * trocado. Ver "Correção de direção" no README.md.
 *
 * Resolucao de arquivo: NAO existe endpoint "obter arquivo por id" na API do
 * Totalk (confirmado contra a documentacao oficial, 24/09/2026 — GET/POST
 * /v2/file sao o fluxo de UPLOAD, nao consulta). O arquivo de uma mensagem
 * ja existente vem embutido na propria mensagem, em details.file (um anexo)
 * ou details.files (varios) — por isso nao ha chamada de rede nenhuma aqui,
 * so leitura do objeto que listarMensagens() ja trouxe. "Midia indisponivel"
 * passa a significar: a mensagem tem fileId/filesIds mas os details nao
 * trouxeram o arquivo correspondente (fica explicito no relatorio, igual
 * antes).
 */
function normalizarMensagem(mensagem, { ehNota }) {
  const direcao = mensagem.direction === "FROM_HUB" ? "entrada" : "saida";
  let autoria;
  // "humano" pra nota, nao um rotulo proprio ("consultor") — messages_author_type_check
  // (0004) so aceita cliente|humano|ia|sistema, mesma convencao do sistema ao
  // vivo (ver criarNotaInternaAction em src/app/(newsec)/atendimento/actions.ts).
  if (ehNota) autoria = "humano";
  else if (direcao === "entrada") autoria = "cliente";
  else if (mensagem.origin === "BOT") autoria = "ia";
  else if (mensagem.userId) autoria = "humano";
  else autoria = "sistema";

  const temReferenciaDeArquivo = Boolean(mensagem.fileId) || Boolean(mensagem.filesIds?.length);
  const arquivoResolvido = mensagem.details?.file ?? mensagem.details?.files?.[0] ?? null;
  const fileIdAusente = temReferenciaDeArquivo && !arquivoResolvido;

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
    arquivoResolvido,
    arquivoIndisponivel: fileIdAusente,
    origemImportacao: "totalk",
  };
}

/** Sessao (Totalk) -> conversation.status (NewSec). Ver constraint conversations_status_check (0004). */
function mapearStatusConversa(statusSessao) {
  switch (statusSessao) {
    case "COMPLETED":
      return "encerrada";
    case "IN_PROGRESS":
      return "humano";
    case "PENDING":
    default:
      return "aguardando_humano";
  }
}

/**
 * Mensagem (Totalk) -> message.status (NewSec). So se aplica a mensagens de
 * SAIDA (agente/sistema -> contato) — mensagem de ENTRADA (cliente -> hub)
 * historica sempre vira "recebida" (o NewSec nao rastreia status de entrega
 * granular pra mensagem que o cliente enviou, so pra saida). Ver constraint
 * messages_status_check (0004).
 */
function mapearStatusMensagem(mensagemNormalizada) {
  if (mensagemNormalizada.ehNotaInterna) return "criada";
  if (mensagemNormalizada.direcao === "entrada") return "recebida";

  switch (mensagemNormalizada.status) {
    case "READ":
      return "lida";
    case "DELIVERED":
      return "entregue";
    case "FAILED":
    case "DELETED":
      return "falha";
    case "SENT":
    case "QUEUED":
    case "SAVED":
    case "PROCESSING":
    case "WAIT_REPLY":
    default:
      return "enviada";
  }
}

/**
 * Resolve (ou cria) o contato pelo telefone — mesma chave de dedupe usada
 * pelo webhook ao vivo (contact_phone_numbers.phone_e164, unico por
 * empresa). Idempotente por natureza: nao depende de nenhum id externo do
 * Totalk gravado em lugar nenhum — perder o checkpoint local nao quebra a
 * resolucao, o telefone e a fonte de verdade.
 */
async function resolverOuCriarContato(supabaseAdmin, companyId, contatoNormalizado) {
  const telefone = contatoNormalizado.telefone;
  if (!telefone) return { contactId: null, foiCriado: false };

  const { data: existente, error: erroSelect } = await supabaseAdmin
    .from("contact_phone_numbers")
    .select("contact_id")
    .eq("company_id", companyId)
    .eq("phone_e164", telefone)
    .maybeSingle();
  if (erroSelect) throw new Error(`buscar contato por telefone ${telefone}: ${erroSelect.message}`);
  if (existente) return { contactId: existente.contact_id, foiCriado: false };

  const { data: contato, error: erroContato } = await supabaseAdmin
    .from("contacts")
    .insert({ company_id: companyId, display_name: contatoNormalizado.nome ?? null })
    .select("id")
    .single();
  if (erroContato) throw new Error(`criar contato (telefone ${telefone}): ${erroContato.message}`);

  const { error: erroTelefone } = await supabaseAdmin
    .from("contact_phone_numbers")
    .insert({ contact_id: contato.id, company_id: companyId, phone_e164: telefone, is_primary: true });
  if (erroTelefone) {
    if (erroTelefone.code === "23505") {
      // Corrida rara (dois processos importando ao mesmo tempo) — outro ja criou entre o select e o insert.
      const { data: recuperado } = await supabaseAdmin
        .from("contact_phone_numbers")
        .select("contact_id")
        .eq("company_id", companyId)
        .eq("phone_e164", telefone)
        .single();
      return { contactId: recuperado.contact_id, foiCriado: false };
    }
    throw new Error(`gravar telefone do contato ${contato.id}: ${erroTelefone.message}`);
  }

  return { contactId: contato.id, foiCriado: true };
}

/** Verificacao read-only pro modo --dry-run — nunca insere. */
async function preverContato(supabaseAdmin, companyId, contatoNormalizado) {
  if (!contatoNormalizado.telefone) return { existe: false };
  const { data } = await supabaseAdmin
    .from("contact_phone_numbers")
    .select("contact_id")
    .eq("company_id", companyId)
    .eq("phone_e164", contatoNormalizado.telefone)
    .maybeSingle();
  return { existe: Boolean(data), contactId: data?.contact_id ?? null };
}

/**
 * Resolve (ou cria) a conversation pela sessao — dedupe por
 * (channel_id, external_id), unico via 0008. Igual ao contato, funciona
 * mesmo com checkpoint local perdido.
 *
 * mapeamento-agentes.json mapeia agenteIdExterno -> um user_profiles.id —
 * mas nada garante que esse id exista de verdade no ambiente de destino
 * desta rodada especifica (ex: mapeamento preenchido pensando em produção,
 * rodando contra homologação; ou id de exemplo/desatualizado). Se o
 * responsavel mapeado nao existir la, a conversa e importada mesmo assim
 * SEM responsavel (nao trava o piloto por causa de um mapeamento ruim) —
 * fica marcada como "responsavelInvalido" pra quem chamou reportar.
 */
async function resolverOuCriarConversa(supabaseAdmin, { companyId, channelId, contactId, sessaoNormalizada }) {
  const { data: existente, error: erroSelect } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("external_id", sessaoNormalizada.idExterno)
    .maybeSingle();
  if (erroSelect) throw new Error(`buscar conversa externa ${sessaoNormalizada.idExterno}: ${erroSelect.message}`);
  if (existente) return { conversationId: existente.id, foiCriado: false, responsavelInvalido: false };

  const insercao = {
    company_id: companyId,
    channel_id: channelId,
    contact_id: contactId,
    external_id: sessaoNormalizada.idExterno,
    assigned_user_profile_id: sessaoNormalizada.responsavelUserId,
    status: mapearStatusConversa(sessaoNormalizada.status),
    last_activity_at: sessaoNormalizada.atualizadoEm ?? sessaoNormalizada.criadoEm,
    first_response_at: sessaoNormalizada.primeiraRespostaEm,
  };

  const { data: nova, error: erroInsert } = await inserirConversaComFallback(supabaseAdmin, insercao);
  if (erroInsert) {
    if (erroInsert.code === "23505") {
      const { data: recuperada } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("channel_id", channelId)
        .eq("external_id", sessaoNormalizada.idExterno)
        .single();
      return { conversationId: recuperada.id, foiCriado: false, responsavelInvalido: false };
    }
    throw new Error(`criar conversa externa ${sessaoNormalizada.idExterno}: ${erroInsert.message}`);
  }

  return { conversationId: nova.id, foiCriado: true, responsavelInvalido: Boolean(insercao.assigned_user_profile_id) && !nova.assigned_user_profile_id };
}

/**
 * Insere a conversa; se falhar por FK de assigned_user_profile_id (id
 * mapeado que nao existe neste ambiente), tenta de novo sem responsavel em
 * vez de propagar o erro e travar a sessao inteira.
 */
async function inserirConversaComFallback(supabaseAdmin, insercao) {
  const primeira = await supabaseAdmin.from("conversations").insert(insercao).select("id, assigned_user_profile_id").single();
  if (!primeira.error) return primeira;
  if (primeira.error.code !== "23503" || !insercao.assigned_user_profile_id) return primeira;

  const semResponsavel = { ...insercao, assigned_user_profile_id: null };
  return supabaseAdmin.from("conversations").insert(semResponsavel).select("id, assigned_user_profile_id").single();
}

/**
 * Atualiza o "estado de lista" da conversa (status/last_activity_at/preview/nao-lidas) — chamado
 * SEMPRE, tanto pra conversa nova quanto pra uma que ja existia, depois que as mensagens/notas da
 * sessao ja foram gravadas. Sem isso, reimportar uma sessao que ja existe insere a mensagem nova
 * certinho (dedupe por external_id continua garantindo isso), mas ela fica "invisivel" — a conversa
 * nao sobe na lista, o preview continua mostrando o texto antigo, nao aparece como nao lida.
 *
 * Por decisao do Gabriel (28/09/2026, enquanto o Totalk continua sendo a fonte viva durante o
 * periodo de validacao): status e nao-lidas SEMPRE seguem o Totalk, mesmo que um consultor ja
 * tenha mexido na conversa dentro do NewSec — reflete a sessao de origem, nao preserva edicao
 * manual. Reavaliar essa regra quando o Totalk for desligado de vez (a´i o NewSec vira a unica
 * fonte de verdade e este importador para de rodar).
 */
async function atualizarBookkeepingConversa(supabaseAdmin, { conversationId, sessaoNormalizada }) {
  const { data: ultima, error: erroUltima } = await supabaseAdmin
    .from("messages")
    .select("body, message_type")
    .eq("conversation_id", conversationId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroUltima) throw new Error(`buscar ultima mensagem da conversa ${conversationId}: ${erroUltima.message}`);

  const preview = ultima ? (ultima.body?.slice(0, 200) ?? `[${ultima.message_type}]`) : null;

  // Responsável também segue o Totalk (mesma regra do status). Isso é o que preenche
  // retroativamente as conversas importadas antes da correção do mapeamento (29/09/2026),
  // que ficaram todas sem responsável — resolverOuCriarConversa só define o responsável na
  // CRIAÇÃO, então sem isto uma conversa já existente nunca ganharia o responsável certo.
  const atualizacao = {
    status: mapearStatusConversa(sessaoNormalizada.status),
    last_activity_at: sessaoNormalizada.atualizadoEm ?? sessaoNormalizada.criadoEm,
    last_message_preview: preview,
    unread_count: sessaoNormalizada.naoLidas,
    assigned_user_profile_id: sessaoNormalizada.responsavelUserId,
  };

  let { error } = await supabaseAdmin.from("conversations").update(atualizacao).eq("id", conversationId);
  if (error?.code === "23503") {
    // Responsável mapeado não existe neste banco — atualiza o resto sem ele, não trava a sessão.
    ({ error } = await supabaseAdmin
      .from("conversations")
      .update({ ...atualizacao, assigned_user_profile_id: null })
      .eq("id", conversationId));
  }
  if (error) throw new Error(`atualizar estado da conversa ${conversationId}: ${error.message}`);
}

/** user_profiles.id do NewSec pro usuário do Totalk que escreveu a mensagem (null se não mapeado). */
function autorNewSec(userIdTotalk, mapeamentoAgentes) {
  if (!userIdTotalk) return null;
  return mapeamentoAgentes.mapeamentos?.[userIdTotalk]?.userIdNewSec ?? null;
}

/**
 * Preenche author_user_profile_id em mensagens humanas que JÁ existiam no banco (importadas antes
 * da correção do mapeamento) — um UPDATE por autor por conversa, não um por mensagem. Só toca
 * mensagem com autor ainda vazio: nunca sobrescreve autoria já definida.
 */
async function preencherAutoresExistentes(supabaseAdmin, conversationId, externalIdsPorAutor) {
  for (const [autorId, externalIds] of externalIdsPorAutor) {
    for (let i = 0; i < externalIds.length; i += 100) {
      const lote = externalIds.slice(i, i + 100);
      const { error } = await supabaseAdmin
        .from("messages")
        .update({ author_user_profile_id: autorId })
        .eq("conversation_id", conversationId)
        .eq("author_type", "humano")
        .is("author_user_profile_id", null)
        .in("external_id", lote);
      if (error) throw new Error(`preencher autor das mensagens da conversa ${conversationId}: ${error.message}`);
    }
  }
}

/** Verificacao read-only pro modo --dry-run — nunca insere. */
async function preverConversa(supabaseAdmin, channelId, sessaoNormalizada) {
  const { data } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("external_id", sessaoNormalizada.idExterno)
    .maybeSingle();
  return { existe: Boolean(data), conversationId: data?.id ?? null };
}

/**
 * Grava uma mensagem/nota historica direto em "messages" — NUNCA passa por
 * enviar_mensagem_com_job() nem cria outbound_jobs (mensagem historica nao
 * aciona reenvio, IA, webhook ou contagem de nova entrada, por
 * especificacao). Dedupe por (conversation_id, external_id), unico desde
 * 0004 — mesma logica de idempotencia das outras entidades.
 */
/**
 * Quantas sessões processar ao mesmo tempo com --destino (sem destino fica 1, pra os testes
 * de fixture continuarem determinísticos). Cada consulta ao banco de produção leva ~450ms
 * (medido em 29/09/2026) — em série, as ~7.500 sessões levavam mais de um dia. 3 em paralelo
 * continua bem abaixo do limite do Totalk (1000 req/5min), que o cliente já espaça.
 */
const CONCORRENCIA_SESSOES = 3;

/** Todos os telefones já cadastrados da empresa numa passada só (páginas de 1000). */
async function carregarTelefonesExistentes(supabaseAdmin, companyId) {
  const mapa = new Map();
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await comRetentativaDeRede(
      () =>
        supabaseAdmin
          .from("contact_phone_numbers")
          .select("phone_e164, contact_id")
          .eq("company_id", companyId)
          .order("id")
          .range(inicio, inicio + 999),
      "carregar telefones existentes",
    );
    if (error) throw new Error(`carregar telefones existentes: ${error.message}`);
    for (const linha of data ?? []) mapa.set(linha.phone_e164, linha.contact_id);
    if (!data || data.length < 1000) break;
  }
  return mapa;
}

/**
 * Grava as mensagens novas de uma sessão numa única chamada (lotes de 500), em vez de uma
 * chamada por mensagem. Se o lote bater em duplicata (corrida, ou um lote anterior que foi
 * gravado mas a resposta se perdeu na rede e a retentativa mandou de novo), cai pra uma por
 * uma, ignorando as que já existem. Devolve os external_id efetivamente gravados agora.
 */
async function gravarLoteMensagens(supabaseAdmin, linhas) {
  const gravadas = new Set();
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("messages").insert(lote);
    if (!error) {
      for (const linha of lote) gravadas.add(linha.external_id);
      continue;
    }
    if (error.code !== "23505") throw new Error(`gravar lote de mensagens: ${error.message}`);
    for (const linha of lote) {
      const { error: erroLinha } = await supabaseAdmin.from("messages").insert(linha);
      if (!erroLinha) gravadas.add(linha.external_id);
      else if (erroLinha.code !== "23505") throw new Error(`gravar mensagem historica ${linha.external_id}: ${erroLinha.message}`);
    }
  }
  return gravadas;
}

function montarLinhaMensagem(companyId, conversationId, mensagemNormalizada, autorId = null) {
  return {
    company_id: companyId,
    conversation_id: conversationId,
    direction: mensagemNormalizada.direcao,
    author_type: mensagemNormalizada.autoria,
    // Só mensagem humana tem autor pessoa — IA/sistema/cliente ficam sem (a tela mostra "IA"/"Sistema").
    author_user_profile_id: mensagemNormalizada.autoria === "humano" ? autorId : null,
    is_internal_note: mensagemNormalizada.ehNotaInterna,
    message_type: mapearTipoMensagem(mensagemNormalizada.tipo),
    body: mensagemNormalizada.texto,
    status: mapearStatusMensagem(mensagemNormalizada),
    external_id: mensagemNormalizada.idExterno,
    created_at: mensagemNormalizada.timestamp,
    updated_at: mensagemNormalizada.timestamp,
  };
}

async function gravarMensagemHistorica(supabaseAdmin, { companyId, conversationId, mensagemNormalizada, externalIdsExistentes, autorId = null }) {
  if (externalIdsExistentes.has(mensagemNormalizada.idExterno)) {
    return { foiCriado: false };
  }

  const insercao = {
    company_id: companyId,
    conversation_id: conversationId,
    direction: mensagemNormalizada.direcao,
    author_type: mensagemNormalizada.autoria,
    // Só mensagem humana tem autor pessoa — IA/sistema/cliente ficam sem (a tela mostra "IA"/"Sistema").
    author_user_profile_id: mensagemNormalizada.autoria === "humano" ? autorId : null,
    is_internal_note: mensagemNormalizada.ehNotaInterna,
    message_type: mapearTipoMensagem(mensagemNormalizada.tipo),
    body: mensagemNormalizada.texto,
    status: mapearStatusMensagem(mensagemNormalizada),
    external_id: mensagemNormalizada.idExterno,
    created_at: mensagemNormalizada.timestamp,
    updated_at: mensagemNormalizada.timestamp,
  };

  const { error } = await supabaseAdmin.from("messages").insert(insercao);
  if (error) {
    if (error.code === "23505") return { foiCriado: false };
    throw new Error(`gravar mensagem historica ${mensagemNormalizada.idExterno}: ${error.message}`);
  }

  return { foiCriado: true };
}

/** Tipos do Totalk (TEXT/STICKER/IMAGE/AUDIO/VIDEO/DOCUMENT/CONTACT/LOCATION/LIST/BUTTONS/TRANSITION/TRACK/NOTE) -> constraint messages_type_check (0004). */
function mapearTipoMensagem(tipoTotalk) {
  switch (tipoTotalk) {
    case "IMAGE":
      return "imagem";
    case "AUDIO":
      return "audio";
    case "VIDEO":
      return "video";
    case "DOCUMENT":
      return "documento";
    case "NOTE":
      return "nota";
    default:
      // STICKER/CONTACT/LOCATION/LIST/BUTTONS/TRANSITION/TRACK e qualquer tipo
      // novo do Totalk caem em "texto" — o corpo (body) preserva o texto
      // original quando existir; nenhum desses tipos e comum no historico de
      // atendimento comercial/juridico que este importador cobre.
      return "texto";
  }
}

/**
 * Variáveis de ambiente por destino — nomes DIFERENTES de propósito (não
 * reaproveita NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY do
 * .env.local, que neste repositório já apontam pra homologação). Isso
 * evita o pior cenário possível aqui: escrever em produção sem querer
 * porque o .env.local do dia estava apontando pro banco errado, ou vice
 * versa. Cada ambiente tem sua própria variável, nomeada pra deixar óbvio
 * qual banco está sendo usado só de olhar o .env.local.
 */
const VARIAVEIS_POR_DESTINO = {
  homologacao: { url: "NEXT_PUBLIC_SUPABASE_URL", chave: "SUPABASE_SERVICE_ROLE_KEY" },
  producao: { url: "PRODUCAO_SUPABASE_URL", chave: "PRODUCAO_SUPABASE_SERVICE_ROLE_KEY" },
};

async function resolverDestino(args) {
  if (!args.destino) return null;
  if (!Object.hasOwn(VARIAVEIS_POR_DESTINO, args.destino)) {
    throw new Error(`--destino="${args.destino}" não suportado — só "homologacao" ou "producao" existem.`);
  }
  if (!args.empresaId || !args.canalId) {
    throw new Error(`--destino=${args.destino} exige --empresa-id=<uuid> e --canal-id=<uuid> explícitos (nunca escolhido sozinho).`);
  }
  // Segunda trava, só pra produção: precisa do flag extra além de --destino=producao — ninguém
  // acerta essa combinação por hábito de copiar e colar um comando de homologação.
  if (args.destino === "producao" && !args.confirmoProducao) {
    throw new Error(
      "--destino=producao exige também --confirmo-producao — trava deliberada, pra nunca gravar em produção por engano " +
        "(ex: copiar e colar um comando que era de homologação). Confirme que é essa mesma a intenção antes de acrescentar a flag.",
    );
  }

  const { url: chaveUrl, chave: chaveServiceRole } = VARIAVEIS_POR_DESTINO[args.destino];
  const SUPABASE_URL = process.env[chaveUrl];
  const SERVICE_ROLE_KEY = process.env[chaveServiceRole];
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(`Faltam ${chaveUrl}/${chaveServiceRole} no .env.local pra --destino=${args.destino}.`);
  }
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: empresa, error: erroEmpresa } = await supabaseAdmin.from("companies").select("id, legal_name").eq("id", args.empresaId).maybeSingle();
  if (erroEmpresa) throw new Error(`buscar empresa --empresa-id=${args.empresaId}: ${erroEmpresa.message}`);
  if (!empresa) throw new Error(`Empresa --empresa-id=${args.empresaId} não encontrada em ${args.destino}.`);

  const { data: canal, error: erroCanal } = await supabaseAdmin.from("channels").select("id, name, provider, company_id").eq("id", args.canalId).maybeSingle();
  if (erroCanal) throw new Error(`buscar canal --canal-id=${args.canalId}: ${erroCanal.message}`);
  if (!canal) throw new Error(`Canal --canal-id=${args.canalId} não encontrado em ${args.destino}.`);
  if (canal.company_id !== empresa.id) {
    throw new Error(`Canal ${args.canalId} pertence à empresa ${canal.company_id}, não à empresa informada ${empresa.id}.`);
  }

  return { ambiente: args.destino, supabaseAdmin, empresa, canal };
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = parseArgs(process.argv.slice(2));

  const destino = await resolverDestino(args);
  const supabaseAdmin = destino?.supabaseAdmin ?? null;

  const modoFixture = !args.real;
  const cliente = criarClienteTotalk({
    modoFixture,
    baseUrl: process.env.TOTALK_IMPORT_BASE_URL,
    token: process.env.TOTALK_IMPORT_TOKEN,
    pastaFixtures: PASTA_FIXTURES,
    // Fixtures continuam com pagina pequena (exercita a paginacao); a API real usa 100 por pagina
    // e ~171 req/min, abaixo do limite continuo do Totalk (1000 req/5min).
    ...(modoFixture ? {} : { tamanhoPagina: TAMANHO_PAGINA_REAL, intervaloMinimoMs: 350 }),
  });

  const mapeamentoAgentes = JSON.parse(await readFile(path.join(DIRETORIO_SCRIPT, "mapeamento-agentes.json"), "utf8"));

  // Só vale mapeamento pra usuário que existe DE VERDADE na empresa de destino. Sem isto, um
  // consultor mapeado que não está naquela empresa (outro ambiente, ou alguém transferido/
  // desligado) faz o banco recusar o lote inteiro de mensagens (trigger NS010) e a importação
  // para no meio. Mapeamento inválido vira "sem responsável/autor" e aparece no log — não derruba.
  if (supabaseAdmin) {
    const { data: usuarios, error: erroUsuarios } = await supabaseAdmin.from("user_profiles").select("id").eq("company_id", destino.empresa.id);
    if (erroUsuarios) throw new Error(`listar usuarios da empresa de destino: ${erroUsuarios.message}`);
    const validos = new Set((usuarios ?? []).map((u) => u.id));
    for (const [userIdTotalk, entrada] of Object.entries(mapeamentoAgentes.mapeamentos ?? {})) {
      if (entrada.userIdNewSec && !validos.has(entrada.userIdNewSec)) {
        console.warn(`[totalk] mapeamento ignorado: ${entrada.nomeTotalk ?? userIdTotalk} -> ${entrada.userIdNewSec} nao existe na empresa de destino.`);
        entrada.userIdNewSec = null;
      }
    }
  }

  const naoMapeados = new Set();
  const midiaIndisponivel = [];
  const responsaveisInvalidos = [];
  const sessoesSemContato = [];
  const erros = [];

  const checkpoint = await carregarCheckpoint(args.reiniciar);
  const retomando = checkpoint.sessoesConcluidas.size > 0 || checkpoint.etapasConcluidas.size > 0;

  const rotuloAmbiente = destino?.ambiente === "producao" ? "PRODUÇÃO — ⚠️ banco real da GRS" : "homologação";
  const descricaoDestino = destino
    ? `${rotuloAmbiente} (empresa "${destino.empresa.legal_name}" [${destino.empresa.id}], canal "${destino.canal.name}" [${destino.canal.id}, provider=${destino.canal.provider}])${args.dryRun ? " — DRY-RUN, nada será gravado" : ""}`
    : "arquivo local (saida/) — nada é gravado no banco";

  console.log(
    `[totalk] Modo: ${modoFixture ? "FIXTURE (sem chamada real)" : "REAL"}${args.reiniciar ? " — reiniciado do zero" : retomando ? " — retomando checkpoint anterior" : ""}`,
  );
  console.log(`[totalk] Destino: ${descricaoDestino}`);

  await mkdir(PASTA_SAIDA, { recursive: true });

  const contatosNormalizados = [];
  const sessoesNormalizadas = [];
  const mensagensNormalizadas = [];
  const mapaContatoParaId = new Map(); // contatoIdExterno -> contact_id do NewSec (so preenchido com --destino)

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

  // Contatos: sempre relistados quando ha destino real (nao so na primeira
  // vez) — precisamos do mapa contatoIdExterno->contact_id nesta execucao
  // pras sessoes abaixo, mesmo que a etapa ja tivesse sido marcada
  // concluida numa rodada anterior. Resolucao por telefone e idempotente
  // (nunca recria), entao relistar e barato e seguro.
  // Sessoes primeiro: com --limite-sessoes (piloto) so importamos os contatos
  // dessas sessoes, nao os milhares de contatos da conta.
  const sessoes = await cliente.listarSessoes({
    limite: args.limiteSessoes,
    ordem: args.limiteSessoes ? "DESCENDING" : "ASCENDING",
  });
  const contatosDoPiloto = args.limiteSessoes ? new Set(sessoes.map((sessao) => sessao.contactId)) : null;
  const contatos = (await cliente.listarContatos()).filter((contato) => !contatosDoPiloto || contatosDoPiloto.has(contato.id));
  if (!checkpoint.etapasConcluidas.has("contatos")) {
    contagens.contatos.esperado = contatos.length;
  } else {
    contagens.contatos.jaVistos = checkpoint.vistos.contato.size;
  }

  // Telefones já cadastrados, numa consulta só — antes era uma ida ao banco por contato
  // (~7.000 × ~450ms = 50 minutos só pra reconferir contatos que já existiam).
  const telefoneParaContato = supabaseAdmin && !args.dryRun ? await carregarTelefonesExistentes(supabaseAdmin, destino.empresa.id) : new Map();

  for (const contato of contatos) {
    const novoLocalmente = !checkpoint.etapasConcluidas.has("contatos") ? marcarVisto(checkpoint, "contato", contato.id) : false;
    const contatoNormalizado = normalizarContato(contato);

    if (supabaseAdmin) {
      if (args.dryRun) {
        const { existe } = await preverContato(supabaseAdmin, destino.empresa.id, contatoNormalizado);
        if (!checkpoint.etapasConcluidas.has("contatos")) {
          if (existe) contagens.contatos.jaVistos += 1;
          else contagens.contatos.novos += 1;
        }
      } else {
        const existente = contatoNormalizado.telefone ? telefoneParaContato.get(contatoNormalizado.telefone) : undefined;
        const { contactId, foiCriado } = existente
          ? { contactId: existente, foiCriado: false }
          : await comRetentativaDeRede(
              () => resolverOuCriarContato(supabaseAdmin, destino.empresa.id, contatoNormalizado),
              `contato ${contato.id}`,
            );
        if (contactId && contatoNormalizado.telefone) telefoneParaContato.set(contatoNormalizado.telefone, contactId);
        if (contactId) mapaContatoParaId.set(contato.id, contactId);
        if (!checkpoint.etapasConcluidas.has("contatos")) {
          if (foiCriado) contagens.contatos.novos += 1;
          else contagens.contatos.jaVistos += 1;
        }
      }
    } else if (!checkpoint.etapasConcluidas.has("contatos")) {
      if (novoLocalmente) {
        contagens.contatos.novos += 1;
        contatosNormalizados.push(contatoNormalizado);
      } else {
        contagens.contatos.jaVistos += 1;
      }
    }
  }
  checkpoint.etapasConcluidas.add("contatos");

  // Importação completa: a LISTAGEM é em ordem crescente (estável — sessão nova entra no fim e
  // não desloca as páginas já lidas), mas o PROCESSAMENTO vai da mais recente pra mais antiga.
  // A lista toda já está em memória neste ponto, então inverter é seguro. Assim, se a importação
  // parar no meio, o que já entrou é o que a equipe mais consulta (pedido do Gabriel, 30/09/2026:
  // procurou um cliente de agosto e ele ainda não tinha sido importado).
  if (!args.limiteSessoes && supabaseAdmin) sessoes.reverse();

  contagens.sessoes.esperado = sessoes.length;
  const totalSessoes = sessoes.length;
  let sessoesProcessadas = 0;

  // Com sessões em paralelo, gravações do checkpoint em disco passam por uma fila — duas
  // escritas simultâneas no mesmo arquivo podiam se intercalar e corrompê-lo.
  let filaCheckpoint = Promise.resolve();
  const salvarCheckpointEmFila = () => {
    filaCheckpoint = filaCheckpoint.then(() => salvarCheckpoint(checkpoint));
    return filaCheckpoint;
  };

  async function processarSessao(sessao) {
    sessoesProcessadas += 1;
    // Log de progresso a cada 25 sessoes (e sempre na ultima) — numa importacao
    // completa (milhares de sessoes, cada uma com pelo menos 2 chamadas de rede
    // ao Totalk) e a unica forma de acompanhar de fora sem abrir o banco.
    if (sessoesProcessadas % 25 === 0 || sessoesProcessadas === totalSessoes) {
      const percentual = Math.round((sessoesProcessadas / totalSessoes) * 100);
      console.log(`[totalk] progresso: ${sessoesProcessadas}/${totalSessoes} sessoes (${percentual}%)`);
    }

    if (marcarVisto(checkpoint, "sessao", sessao.id)) {
      contagens.sessoes.novos += 1;
      sessoesNormalizadas.push(normalizarSessao(sessao, mapeamentoAgentes, naoMapeados));
    } else {
      contagens.sessoes.jaVistos += 1;
    }

    // Sem destino real, o checkpoint local e a unica fonte de verdade —
    // sessao ja concluida numa rodada anterior e pulada sem reprocessar
    // (e o que garante "retomar lote nao reprocessa tudo"). COM destino
    // real, o checkpoint local vira so uma otimizacao: a fonte de verdade
    // pra dedupe de mensagem e o banco (external_id), verificado abaixo —
    // entao sempre reprocessamos a sessao quando ha destino, mesmo que o
    // checkpoint local diga "concluida" (ex: rodada anterior so escreveu
    // arquivo local, e agora e a primeira vez gravando de verdade).
    if (!supabaseAdmin && checkpoint.sessoesConcluidas.has(sessao.id)) {
      return;
    }

    try {
      let conversationId = null;
      let externalIdsExistentes = new Set();
      const sessaoNormalizada = normalizarSessao(sessao, mapeamentoAgentes, naoMapeados);

      if (supabaseAdmin) {
        const contactId = mapaContatoParaId.get(sessao.contactId) ?? null;

        // conversations.contact_id e NOT NULL: sessao de contato sem telefone (ou que nao
        // veio na listagem) nao tem onde ser gravada — vai pro relatorio, nao derruba o lote.
        if (!args.dryRun && !contactId) {
          sessoesSemContato.push({ sessaoId: sessao.id, contatoIdExterno: sessao.contactId ?? null });
          return;
        }

        if (args.dryRun) {
          const { conversationId: idExistente } = await preverConversa(supabaseAdmin, destino.canal.id, sessaoNormalizada);
          conversationId = idExistente;
        } else {
          const { conversationId: idResolvido, responsavelInvalido } = await comRetentativaDeRede(
            () =>
              resolverOuCriarConversa(supabaseAdmin, {
                companyId: destino.empresa.id,
                channelId: destino.canal.id,
                contactId,
                sessaoNormalizada,
              }),
            `conversa ${sessao.id}`,
          );
          if (responsavelInvalido) {
            responsaveisInvalidos.push({ sessaoId: sessao.id, userIdMapeado: sessaoNormalizada.responsavelUserId });
          }
          conversationId = idResolvido;
        }

        if (conversationId) {
          const { data: existentes, error: erroExistentes } = await comRetentativaDeRede(
            () =>
              supabaseAdmin
                .from("messages")
                .select("external_id")
                .eq("conversation_id", conversationId)
                .not("external_id", "is", null),
            `listar mensagens da conversa ${conversationId}`,
          );
          if (erroExistentes) throw new Error(`listar mensagens existentes da conversa ${conversationId}: ${erroExistentes.message}`);
          externalIdsExistentes = new Set((existentes ?? []).map((m) => m.external_id));
        }
      }

      const mensagens = await cliente.listarMensagens(sessao.id);
      contagens.mensagens.esperado += mensagens.length;
      // Mensagens humanas que já existiam no banco, agrupadas por autor — preenchidas no fim da sessão.
      const autoresParaPreencher = new Map();
      // Mensagens/notas novas desta sessão — gravadas todas de uma vez no fim (gravarLoteMensagens).
      const linhasNovas = [];

      for (const mensagem of mensagens) {
        const novaLocalmente = marcarVisto(checkpoint, "mensagem", mensagem.id);
        const mensagemNormalizada = normalizarMensagem(mensagem, { ehNota: false });
        const autorId = autorNewSec(mensagem.userId, mapeamentoAgentes);

        if (mensagemNormalizada.arquivoIndisponivel) {
          midiaIndisponivel.push({ mensagemId: mensagem.id, sessaoId: sessao.id, arquivoId: mensagem.fileId ?? mensagem.filesIds?.[0] ?? null });
        }

        if (supabaseAdmin) {
          const jaExiste = externalIdsExistentes.has(mensagemNormalizada.idExterno);
          if (jaExiste && autorId && mensagemNormalizada.autoria === "humano") {
            if (!autoresParaPreencher.has(autorId)) autoresParaPreencher.set(autorId, []);
            autoresParaPreencher.get(autorId).push(mensagemNormalizada.idExterno);
          }
          if (args.dryRun) {
            if (jaExiste) contagens.mensagens.jaVistos += 1;
            else contagens.mensagens.novos += 1;
          } else if (conversationId) {
            if (jaExiste) {
              contagens.mensagens.jaVistos += 1;
            } else {
              linhasNovas.push({ tipo: "mensagens", linha: montarLinhaMensagem(destino.empresa.id, conversationId, mensagemNormalizada, autorId) });
              // Evita mandar duas vezes a mesma mensagem se o Totalk repetir um item entre páginas.
              externalIdsExistentes.add(mensagemNormalizada.idExterno);
            }
          }
        } else if (novaLocalmente) {
          contagens.mensagens.novos += 1;
          mensagensNormalizadas.push(mensagemNormalizada);
        } else {
          contagens.mensagens.jaVistos += 1;
        }
      }

      const notas = await cliente.listarNotas(sessao.id);
      contagens.notas.esperado += notas.length;

      for (const nota of notas) {
        const novaLocalmente = marcarVisto(checkpoint, "nota", nota.id);
        const notaNormalizada = normalizarMensagem(
          // TO_HUB = "saida" (ver normalizarMensagem) — nota interna e sempre escrita por um humano da
          // equipe, nunca pelo contato, entao trocou junto com a correcao da direcao (era FROM_HUB).
          { ...nota, sessionId: nota.sessionId, type: "NOTE", direction: "TO_HUB", text: nota.text },
          { ehNota: true },
        );

        if (supabaseAdmin) {
          const jaExiste = externalIdsExistentes.has(notaNormalizada.idExterno);
          const autorNotaId = autorNewSec(nota.userId, mapeamentoAgentes);
          if (jaExiste && autorNotaId) {
            if (!autoresParaPreencher.has(autorNotaId)) autoresParaPreencher.set(autorNotaId, []);
            autoresParaPreencher.get(autorNotaId).push(notaNormalizada.idExterno);
          }
          if (args.dryRun) {
            if (jaExiste) contagens.notas.jaVistos += 1;
            else contagens.notas.novos += 1;
          } else if (conversationId) {
            if (jaExiste) {
              contagens.notas.jaVistos += 1;
            } else {
              linhasNovas.push({ tipo: "notas", linha: montarLinhaMensagem(destino.empresa.id, conversationId, notaNormalizada, autorNotaId) });
              externalIdsExistentes.add(notaNormalizada.idExterno);
            }
          }
        } else if (novaLocalmente) {
          contagens.notas.novos += 1;
          mensagensNormalizadas.push(notaNormalizada);
        } else {
          contagens.notas.jaVistos += 1;
        }
      }

      if (supabaseAdmin && !args.dryRun && conversationId) {
        if (linhasNovas.length > 0) {
          const gravadas = await comRetentativaDeRede(
            () => gravarLoteMensagens(supabaseAdmin, linhasNovas.map((item) => item.linha)),
            `lote de mensagens ${sessao.id}`,
          );
          for (const item of linhasNovas) {
            if (gravadas.has(item.linha.external_id)) contagens[item.tipo].novos += 1;
            else contagens[item.tipo].jaVistos += 1;
          }
        }
        if (autoresParaPreencher.size > 0) {
          await comRetentativaDeRede(
            () => preencherAutoresExistentes(supabaseAdmin, conversationId, autoresParaPreencher),
            `autores ${sessao.id}`,
          );
        }
        await comRetentativaDeRede(
          () => atualizarBookkeepingConversa(supabaseAdmin, { conversationId, sessaoNormalizada }),
          `bookkeeping ${sessao.id}`,
        );
      }

      checkpoint.sessoesConcluidas.add(sessao.id);
      // Salva o checkpoint AGORA, so depois que os dados desta sessao ja
      // estao duravelmente gravados (arquivo local em modo padrao, banco em
      // --destino) — nunca marca "concluida" antes de escrever, senao uma
      // queda no meio do processo mascararia perda de dado (o checkpoint
      // diria "ja fiz" sem ter feito).
      await salvarCheckpointEmFila();

      if (args.falharAposSessao === sessao.id) {
        // Flag de teste: simula uma queda logo depois de concluir esta
        // sessao (ja marcada concluida e persistida acima) — usado pra
        // provar que a proxima rodada retoma da sessao SEGUINTE, sem sequer
        // refazer a chamada de mensagens/notas desta (ver README).
        throw new Error(`Interrupcao proposital apos a sessao ${sessao.id} (--falhar-apos-sessao).`);
      }
    } catch (erro) {
      erros.push({ etapa: `sessao ${sessao.id}`, detalhe: erro.message });
      await salvarCheckpointEmFila();
      throw erro;
    }
  }

  // Várias sessões ao mesmo tempo só quando grava de verdade no banco; sem destino (fixtures,
  // arquivo local) segue uma por vez, na ordem — os testes de retomada dependem disso.
  const concorrencia = supabaseAdmin && !args.dryRun ? CONCORRENCIA_SESSOES : 1;
  let proximaSessao = 0;
  let houveFalha = false;
  async function trabalhador() {
    while (!houveFalha && proximaSessao < sessoes.length) {
      const sessao = sessoes[proximaSessao];
      proximaSessao += 1;
      try {
        await processarSessao(sessao);
      } catch (erro) {
        houveFalha = true;
        throw erro;
      }
    }
  }
  // allSettled: se uma sessão falhar, as outras em andamento terminam direito (nada fica pela
  // metade à toa) antes de o erro ser repassado e a importação parar.
  const resultados = await Promise.allSettled(Array.from({ length: concorrencia }, () => trabalhador()));
  await filaCheckpoint;
  const primeiraFalha = resultados.find((r) => r.status === "rejected");
  if (primeiraFalha) throw primeiraFalha.reason;

  await salvarCheckpoint(checkpoint);

  // Escreve so o delta desta rodada; rodadas anteriores ja escreveram o
  // delta delas em execucoes passadas — concatenar historico local fica a
  // cargo de quem consumir saida/ (nao e o papel deste importador). Com
  // --destino, os arquivos locais ficam vazios (a gravacao de verdade foi
  // pro banco) — mantidos mesmo assim como rastro de auditoria da rodada.
  await writeFile(path.join(PASTA_SAIDA, "contatos-normalizados.json"), JSON.stringify(contatosNormalizados, null, 2), "utf8");
  await writeFile(path.join(PASTA_SAIDA, "conversas-normalizadas.json"), JSON.stringify(sessoesNormalizadas, null, 2), "utf8");
  await writeFile(path.join(PASTA_SAIDA, "mensagens-normalizadas.json"), JSON.stringify(mensagensNormalizadas, null, 2), "utf8");

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: modoFixture ? "fixture" : "real",
    destino: destino ? { ambiente: destino.ambiente, empresaId: destino.empresa.id, canalId: destino.canal.id, dryRun: args.dryRun } : { ambiente: "arquivo-local" },
    retomandoCheckpointAnterior: retomando,
    contagens,
    agentesNaoMapeados: [...naoMapeados],
    midiaIndisponivel,
    responsaveisInvalidos,
    sessoesSemContato,
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
  if (sessoesSemContato.length > 0) {
    console.log(`[totalk] Sessoes puladas por contato sem telefone/ausente (${sessoesSemContato.length}): ver saida/relatorio-reconciliacao.json`);
  }
  if (responsaveisInvalidos.length > 0) {
    console.log(`[totalk] Responsavel mapeado nao existe no destino (${responsaveisInvalidos.length}): conversa importada sem responsavel, ver saida/relatorio-reconciliacao.json`);
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

  linhas.push("", "## Responsáveis mapeados que não existem no ambiente de destino (conversa importada sem responsável)", "");
  linhas.push(
    (relatorio.responsaveisInvalidos ?? []).length === 0
      ? "Nenhum."
      : relatorio.responsaveisInvalidos.map((item) => `- sessão ${item.sessaoId}: user_profiles.id ${item.userIdMapeado} não existe neste ambiente`).join("\n"),
  );

  linhas.push("", "## Sessões puladas: contato sem telefone ou ausente (conversations.contact_id é obrigatório)", "");
  linhas.push(
    (relatorio.sessoesSemContato ?? []).length === 0
      ? "Nenhuma."
      : relatorio.sessoesSemContato.map((item) => `- sessão ${item.sessaoId} (contato externo ${item.contatoIdExterno})`).join("\n"),
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
