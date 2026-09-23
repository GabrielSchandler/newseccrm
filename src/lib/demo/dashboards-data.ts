/**
 * Dados sinteticos do modo de demonstracao de /dashboards (Fase 1).
 * Nada aqui vem de banco real. Numeros sao internamente coerentes
 * (funil decrescente, percentuais batendo com os valores) mas ficticios.
 */

export const cardsGestaoDemo = [
  { rotulo: "Vendas", valor: "R$ 48.000", variacao: "+12%", tendencia: "alta" as const },
  { rotulo: "Recebido", valor: "R$ 36.000", variacao: "+8%", tendencia: "alta" as const },
  { rotulo: "Pré-vendas", valor: "64", variacao: "+14%", tendencia: "alta" as const },
  { rotulo: "Novos contatos", valor: "120", variacao: "+10%", tendencia: "alta" as const },
  { rotulo: "Aguardando resposta", valor: "12", variacao: "+33%", tendencia: "atencao" as const },
  { rotulo: "SLA", valor: "92%", variacao: "+4 p.p.", tendencia: "alta" as const },
];

export const vendasPorSemanaDemo = [
  { semana: "Sem 1", valor: 10000 },
  { semana: "Sem 2", valor: 15000 },
  { semana: "Sem 3", valor: 12000 },
  { semana: "Sem 4", valor: 20000 },
];

export const funilComercialDemo = [
  { etapa: "Contatos", valor: 120 },
  { etapa: "Qualificados", valor: 78 },
  { etapa: "Pré-vendas", valor: 64 },
  { etapa: "Vendas", valor: 28 },
];

export const desempenhoEquipeDemo = [
  { equipe: "Comercial", novosContatos: 98, preVendas: 56, vendas: 28, sla: "90%" },
  { equipe: "Jurídico", novosContatos: 22, preVendas: 8, vendas: null, sla: "95%" },
];

export const insightsGestaoDemo = [
  {
    id: "i1",
    titulo: "4 conversas sem responsável",
    descricao: "Existem 4 conversas abertas sem um responsável definido.",
    tipo: "alerta" as const,
  },
  {
    id: "i2",
    titulo: "Revisar retornos vencidos",
    descricao: "Há 12 interações com prazo de retorno vencido.",
    tipo: "aviso" as const,
  },
];
