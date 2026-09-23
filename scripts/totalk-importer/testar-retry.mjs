/**
 * Teste isolado do backoff em 429/5xx — o modo fixture nunca passa por
 * `requisitarReal`/`chamarComRetentativa` (le arquivo local direto), entao
 * esse caminho de codigo fica sem cobertura nos testes normais do
 * importador. Este script prova que ele de fato tenta de novo e se
 * recupera, sem depender de rede real: monkeypatcha `globalThis.fetch` pra
 * simular 2 respostas 429 seguidas de uma 200.
 *
 * Uso: node scripts/totalk-importer/testar-retry.mjs
 */

import assert from "node:assert/strict";
import { criarClienteTotalk } from "./cliente-totalk.mjs";

let chamadas = 0;
const inicioMs = Date.now();

globalThis.fetch = async () => {
  chamadas += 1;
  if (chamadas <= 2) {
    return { ok: false, status: 429, json: async () => ({}) };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ pageNumber: 1, pageSize: 15, totalItems: 1, totalPages: 1, hasMorePages: false, items: [{ id: "dep-teste" }] }),
  };
};

const cliente = criarClienteTotalk({
  modoFixture: false,
  baseUrl: "https://exemplo-invalido.totalk.test",
  token: "token-de-teste",
  pastaFixtures: "/nao-usado",
});

const departamentos = await cliente.listarDepartamentos();
const duracaoMs = Date.now() - inicioMs;

assert.equal(chamadas, 3, `esperava 3 chamadas (2 falhas + 1 sucesso), teve ${chamadas}`);
assert.equal(departamentos.length, 1, "esperava 1 item retornado apos a recuperacao");
assert.equal(departamentos[0].id, "dep-teste");
assert.ok(duracaoMs >= 500 + 1000, `esperava pelo menos ~1500ms de backoff (500+1000), levou ${duracaoMs}ms`);

console.log(`[teste-retry] OK — 2 respostas 429 seguidas de recuperacao, ${chamadas} chamadas, ${duracaoMs}ms (backoff exponencial confirmado).`);

// Segundo cenario: erro permanente (401) nao deve gerar retentativa nenhuma.
let chamadas401 = 0;
globalThis.fetch = async () => {
  chamadas401 += 1;
  return { ok: false, status: 401, json: async () => ({}) };
};

const clienteErroPermanente = criarClienteTotalk({
  modoFixture: false,
  baseUrl: "https://exemplo-invalido.totalk.test",
  token: "token-invalido",
  pastaFixtures: "/nao-usado",
});

await assert.rejects(() => clienteErroPermanente.listarDepartamentos(), /401/);
assert.equal(chamadas401, 1, `401 nao e transitorio — esperava 1 chamada sem retentativa, teve ${chamadas401}`);

console.log("[teste-retry] OK — erro permanente (401) nao gera retentativa, falha na primeira tentativa.");
