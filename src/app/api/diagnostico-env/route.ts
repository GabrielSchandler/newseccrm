import { NextResponse } from "next/server";

/**
 * ROTA TEMPORARIA DE DIAGNOSTICO — remover depois de resolver o problema de
 * variaveis de ambiente na Vercel (setembro/2026).
 *
 * Nao expoe valor de chave nenhuma: so informa se a variavel existe, quantos
 * caracteres tem e como comeca (prefixo curto, suficiente pra identificar se
 * alguem colou uma chave no campo da URL ou vice-versa).
 */

export const dynamic = "force-dynamic";

function descrever(nome: string) {
  const valor = process.env[nome];

  if (valor === undefined) {
    return { nome, situacao: "AUSENTE (undefined)" };
  }

  if (valor === "") {
    return { nome, situacao: "VAZIA (string vazia)" };
  }

  return {
    nome,
    situacao: "presente",
    caracteres: valor.length,
    comecaCom: valor.slice(0, 8),
    pareceUrl: valor.startsWith("https://"),
    temEspacoNasPontas: valor !== valor.trim(),
  };
}

export async function GET() {
  return NextResponse.json({
    aviso: "rota temporaria de diagnostico; nao expoe valores de chave",
    ambiente: process.env.VERCEL_ENV ?? "desconhecido",
    variaveis: [
      descrever("NEXT_PUBLIC_SUPABASE_URL"),
      descrever("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      descrever("SUPABASE_SERVICE_ROLE_KEY"),
    ],
    nomesComSupabase: Object.keys(process.env)
      .filter((chave) => chave.toUpperCase().includes("SUPABASE"))
      .sort(),
  });
}
