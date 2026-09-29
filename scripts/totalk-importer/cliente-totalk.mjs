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
 * Caminhos reais confirmados contra a conta da GRS em 28/09/2026: /core/v1/{department,agent,contact}
 * (departamento e agente vem como lista simples, sem paginacao) e /chat/v1/session[/{id}/message|note].
 * A documentacao generica (flwchat.readme.io, /v1/... e /v2/...) NAO vale pra esta conta.
 *
 * IMPORTANTE: este cliente e so leitura (GET/POST de listagem/filtro). Nunca
 * chama endpoint de envio de mensagem, campanha, chatbot ou OTP — o
 * importador de historico nao pode disparar nada real no Totalk.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const TAMANHO_PAGINA_PADRAO = 3;
// A API real aceita ate 100 itens por pagina (500 ja devolve erro 500 — testado em 28/09/2026).
export const TAMANHO_PAGINA_REAL = 100;
const MAX_TENTATIVAS = 5;
const ATRASO_BASE_MS = 500;

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resposta da API real pode ser pagina ({ items }) ou lista simples (departamento/agente). */
function extrairItens(resposta) {
  return Array.isArray(resposta) ? resposta : resposta.items;
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

export function criarClienteTotalk({ modoFixture, baseUrl, token, pastaFixtures, tamanhoPagina = TAMANHO_PAGINA_PADRAO, intervaloMinimoMs = 0 }) {
  if (!modoFixture && !token) {
    throw new Error("Modo real exige TOTALK_IMPORT_TOKEN configurado (ver README.md deste diretorio).");
  }

  let ultimaRequisicaoEm = 0;

  async function paginaDe(rotulo, { metodo, caminho, query, corpo, arquivoFixture }) {
    if (modoFixture) {
      const dados = await lerFixture(pastaFixtures, arquivoFixture);
      return paginarEmMemoria(dados.items, { pageNumber: query?.PageNumber ?? 1, pageSize: query?.PageSize ?? tamanhoPagina });
    }

    return chamarComRetentativa(async () => {
      // Espaca as chamadas pra ficar abaixo do limite continuo do Totalk (1000 req/5min).
      // Cada chamada RESERVA seu horario antes de esperar — com sessoes em paralelo, calcular
      // a espera e so depois marcar o horario deixava varias chamadas sairem juntas.
      const meuHorario = Math.max(Date.now(), ultimaRequisicaoEm + intervaloMinimoMs);
      ultimaRequisicaoEm = meuHorario;
      const espera = meuHorario - Date.now();
      if (espera > 0) await dormir(espera);
      return requisitarReal({ baseUrl, token, metodo, caminho, query, corpo });
    }, { rotulo });
  }

  /** Percorre as paginas de um recurso ate acabar (ou ate "limite" itens), retornando a lista. */
  async function listarTudo(rotulo, paginaFn, { limite = null } = {}) {
    const itens = [];
    let pageNumber = 1;

    for (;;) {
      const resposta = await paginaFn(pageNumber);
      itens.push(...extrairItens(resposta));
      // Lista simples (departamento/agente reais) nao tem paginacao: uma chamada so.
      if (Array.isArray(resposta) || !resposta.hasMorePages) break;
      if (limite && itens.length >= limite) break;
      pageNumber += 1;
    }

    return limite ? itens.slice(0, limite) : itens;
  }

  return {
    async listarDepartamentos() {
      return listarTudo("departamentos", (pageNumber) =>
        paginaDe("departamentos", {
          metodo: "GET",
          caminho: "/core/v1/department",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: "departamentos.json",
        }),
      );
    },

    async listarAgentes() {
      return listarTudo("agentes", (pageNumber) =>
        paginaDe("agentes", {
          metodo: "GET",
          caminho: "/core/v1/agent",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: "agentes.json",
        }),
      );
    },

    async listarContatos() {
      return listarTudo("contatos", (pageNumber) =>
        paginaDe("contatos", {
          metodo: "GET",
          caminho: "/core/v1/contact",
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: "contatos.json",
        }),
      );
    },

    /**
     * "ordem" so importa na API real. Importacao completa usa ASCENDING (sessao nova
     * entra no fim e nao desloca as paginas ja lidas); piloto com "limite" usa
     * DESCENDING pra pegar as mais recentes sem percorrer tudo.
     */
    async listarSessoes({ limite = null, ordem = "ASCENDING" } = {}) {
      return listarTudo(
        "sessoes",
        (pageNumber) =>
          paginaDe("sessoes", {
            metodo: "GET",
            caminho: "/chat/v1/session",
            query: { PageNumber: pageNumber, PageSize: tamanhoPagina, OrderBy: "createdAt", OrderDirection: ordem },
            arquivoFixture: "sessoes.json",
          }),
        { limite },
      );
    },

    async listarMensagens(sessionId) {
      return listarTudo(`mensagens de ${sessionId}`, (pageNumber) =>
        paginaDe(`mensagens de ${sessionId}`, {
          metodo: "GET",
          caminho: `/chat/v1/session/${sessionId}/message`,
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina, OrderBy: "createdAt", OrderDirection: "ASCENDING" },
          arquivoFixture: path.join("mensagens", `${sessionId}.json`),
        }),
      );
    },

    async listarNotas(sessionId) {
      return listarTudo(`notas de ${sessionId}`, (pageNumber) =>
        paginaDe(`notas de ${sessionId}`, {
          metodo: "GET",
          caminho: `/chat/v1/session/${sessionId}/note`,
          query: { PageNumber: pageNumber, PageSize: tamanhoPagina },
          arquivoFixture: path.join("notas", `${sessionId}.json`),
        }),
      );
    },
  };
}
