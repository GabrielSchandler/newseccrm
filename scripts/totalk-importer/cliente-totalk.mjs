/**
 * Cliente da API do Totalk (flw.chat), com dois modos:
 *
 * - "fixture": le arquivos JSON locais em fixtures/, sem nenhuma chamada de
 *   rede. E o modo padrao enquanto nao houver token real configurado.
 * - "real": chama a API de verdade (https://flwchat.readme.io/), respeitando
 *   rate limit (1000 req/5min continuo, rajada de 200 req/5s — ver
 *   https://flwchat.readme.io/reference/rate-limiting) com backoff
 *   exponencial em 429/5xx.
 *
 * Paginacao e por pageNumber/pageSize (offset), conforme
 * https://flwchat.readme.io/reference/paginação — o chamador deve manter o
 * mesmo pageSize entre paginas e parar quando "hasMorePages" for false.
 *
 * IMPORTANTE: este cliente e so leitura (GET/POST de listagem/filtro). Nunca
 * chama endpoint de envio de mensagem, campanha, chatbot ou OTP — o
 * importador de historico nao pode disparar nada real no Totalk.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const TAMANHO_PAGINA_PADRAO = 3;
const MAX_TENTATIVAS = 5;
const ATRASO_BASE_MS = 500;

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pagina em memoria um array completo, imitando a resposta paginada real da
 * API (mesmos campos: pageNumber/pageSize/totalItems/totalPages/hasMorePages).
 */
function paginarEmMemoria(itens, { pageNumber = 1, pageSize = TAMANHO_PAGINA_PADRAO }) {
  const inicio = (pageNumber - 1) * pageSize;
  const pagina = itens.slice(inicio, inicio + pageSize);
  const totalPages = Math.max(Math.ceil(itens.length / pageSize), 1);

  return {
    pageNumber,
    pageSize,
    totalItems: itens.length,
    totalPages,
    hasMorePages: pageNumber < totalPages,
    items: pagina,
  };
}

async function lerFixture(pastaFixtures, caminhoRelativo) {
  const caminho = path.join(pastaFixtures, caminhoRelativo);
  try {
    const conteudo = await readFile(caminho, "utf8");
    return JSON.parse(conteudo);
  } catch (erro) {
    if (erro.code === "ENOENT") {
      // Sessao sem mensagem/nota ainda: fixture ausente e tratado igual a
      // uma lista vazia, nao como erro — evita exigir um arquivo por sessao
      // mesmo quando nao ha nada pra importar dali.
      return { items: [] };
    }
    throw erro;
  }
}

async function chamarComRetentativa(fn, { rotulo }) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      const transitorio = erro.status === 429 || (erro.status >= 500 && erro.status < 600);

      if (!transitorio || tentativa === MAX_TENTATIVAS) {
        throw erro;
      }

      const atrasoMs = ATRASO_BASE_MS * 2 ** (tentativa - 1);
      console.warn(
        `[totalk] ${rotulo}: falha transitoria (${erro.status ?? erro.message}), tentativa ${tentativa}/${MAX_TENTATIVAS} — aguardando ${atrasoMs}ms antes de repetir.`,
      );
      await dormir(atrasoMs);
    }
  }

  throw ultimoErro;
}

async function requisitarReal({ baseUrl, token, metodo, caminho, query, corpo }) {
  const url = new URL(caminho, baseUrl);
  if (query) {
    for (const [chave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null) continue;
      if (Array.isArray(valor)) {
        for (const item of valor) url.searchParams.append(chave, String(item));
      } else {
        url.searchParams.set(chave, String(valor));
      }
    }
  }

  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  if (!resposta.ok) {
    const erro = new Error(`Totalk API respondeu ${resposta.status} em ${metodo} ${caminho}`);
    erro.status = resposta.status;
    throw erro;
  }

  return resposta.json();
}

export function criarClienteTotalk({ modoFixture, baseUrl, token, pastaFixtures, tamanhoPagina = TAMANHO_PAGINA_PADRAO }) {
  if (!modoFixture && !token) {
    throw new Error("Modo real exige TOTALK_IMPORT_TOKEN configurado (ver README.md deste diretorio).");
  }

  async function paginaDe(rotulo, { metodo, caminho, query, corpo, arquivoFixture }) {
    if (modoFixture) {
      const dados = await lerFixture(pastaFixtures, arquivoFixture);
      return paginarEmMemoria(dados.items, { pageNumber: query?.PageNumber ?? 1, pageSize: query?.PageSize ?? tamanhoPagina });
    }

    return chamarComRetentativa(() => requisitarReal({ baseUrl, token, metodo, caminho, query, corpo }), { rotulo });
  }

  /** Percorre todas as paginas de um recurso, retornando a lista completa. */
  async function listarTudo(rotulo, paginaFn) {
    const itens = [];
    let pageNumber = 1;

    for (;;) {
      const resposta = await paginaFn(pageNumber);
      itens.push(...resposta.items);
      if (!resposta.hasMorePages) break;
      pageNumber += 1;
    }

    return itens;
  }

  return {
    async listarDepartamentos() {
      return listarTudo("departamentos", (pageNumber) =>
        paginaDe("departamentos", {
          metodo: "GET",
          caminho: "/v1/department",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: "departamentos.json",
        }),
      );
    },

    async listarAgentes() {
      return listarTudo("agentes", (pageNumber) =>
        paginaDe("agentes", {
          metodo: "GET",
          caminho: "/v1/agent",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: "agentes.json",
        }),
      );
    },

    async listarContatos() {
      return listarTudo("contatos", (pageNumber) =>
        paginaDe("contatos", {
          metodo: "POST",
          caminho: "/v1/contact/filter",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          corpo: { pageNumber, pageSize: tamanhoPagina, status: "ACTIVE" },
          arquivoFixture: "contatos.json",
        }),
      );
    },

    async listarSessoes() {
      return listarTudo("sessoes", (pageNumber) =>
        paginaDe("sessoes", {
          metodo: "GET",
          caminho: "/v2/session",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina, IncludeDetails: ["AgentDetails", "ContactDetails", "DepartmentsDetails"] },
          arquivoFixture: "sessoes.json",
        }),
      );
    },

    async listarMensagens(sessionId) {
      return listarTudo(`mensagens de ${sessionId}`, (pageNumber) =>
        paginaDe(`mensagens de ${sessionId}`, {
          metodo: "GET",
          caminho: `/v1/session/${sessionId}/message`,
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina, OrderBy: "createdAt", OrderDirection: "ASCENDING" },
          arquivoFixture: path.join("mensagens", `${sessionId}.json`),
        }),
      );
    },

    async listarNotas(sessionId) {
      return listarTudo(`notas de ${sessionId}`, (pageNumber) =>
        paginaDe(`notas de ${sessionId}`, {
          metodo: "GET",
          caminho: `/v1/session/${sessionId}/note`,
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: path.join("notas", `${sessionId}.json`),
        }),
      );
    },
  };
}
