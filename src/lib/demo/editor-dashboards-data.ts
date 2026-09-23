/**
 * Dados sinteticos do modo de demonstracao de /dashboards/personalizar
 * (editor de dashboards, Tela 09 da especificacao). Implementacao completa
 * (drag/resize real, formulas validadas por parser) e Fase 6 — aqui e so a
 * casca visual, igual as outras telas do shell novo.
 */

export type IndicadorCatalogo = {
  id: string;
  nome: string;
  descricao: string;
};

export const catalogoIndicadoresDemo: IndicadorCatalogo[] = [
  { id: "contatos_convertidos", nome: "Contatos convertidos", descricao: "Total de contatos que viraram venda" },
  { id: "contatos_coorte", nome: "Contatos da coorte", descricao: "Total de contatos no período" },
  { id: "vendas", nome: "Vendas", descricao: "Total de vendas realizadas" },
  { id: "receita_recebida", nome: "Receita recebida", descricao: "Valores efetivamente recebidos" },
  { id: "tempo_resposta", nome: "Tempo de resposta", descricao: "Tempo médio de primeira resposta" },
  { id: "produtividade", nome: "Produtividade", descricao: "Atendimentos por colaborador" },
];

export type CardTipo = "linha" | "barra" | "donut";

export type CardDashboardDemo = {
  id: string;
  titulo: string;
  tipo: CardTipo;
  valorPrincipal?: string;
  variacao?: string;
  legenda?: string;
  serieLinha?: number[];
  rotulosLinha?: string[];
  serieBarra?: number[];
  rotulosBarra?: string[];
  donut?: { percentual: number; convertidos: number; naoConvertidos: number; total: number };
};

export const cardsEditorDemo: CardDashboardDemo[] = [
  {
    id: "vendas",
    titulo: "Vendas",
    tipo: "linha",
    valorPrincipal: "48",
    variacao: "+12%",
    legenda: "vendas no mês",
    serieLinha: [12, 22, 30, 26, 34, 48],
    rotulosLinha: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
  },
  {
    id: "recebido",
    titulo: "Recebido",
    tipo: "barra",
    valorPrincipal: "R$ 284.500",
    variacao: "+18%",
    legenda: "no mês atual",
    serieBarra: [40, 90, 130, 190, 165, 245],
    rotulosBarra: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
  },
  {
    id: "conversao_contatos",
    titulo: "Conversão de contatos",
    tipo: "donut",
    valorPrincipal: "23%",
    variacao: "+5 p.p.",
    legenda: "no mês atual",
    donut: { percentual: 23, convertidos: 48, naoConvertidos: 162, total: 210 },
  },
  {
    id: "vendas_por_semana",
    titulo: "Vendas por semana",
    tipo: "barra",
    serieBarra: [8, 12, 15, 13],
    rotulosBarra: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
  },
];

export type ConfiguracaoIndicador = {
  nome: string;
  tipo: string;
  periodo: string;
  formulaNumerador: string;
  formulaDenominador: string;
  multiplicador: string;
  exibicaoSemDados: string;
  compartilhamento: "pessoal" | "empresa";
  tamanhoCard: "compacto" | "largo" | "alto";
};

export const configuracaoDemoPorCard: Record<string, ConfiguracaoIndicador> = {
  conversao_contatos: {
    nome: "Conversão de contatos",
    tipo: "Percentual",
    periodo: "Coorte do mês",
    formulaNumerador: "Contatos convertidos",
    formulaDenominador: "Contatos da coorte",
    multiplicador: "100",
    exibicaoSemDados: "Sem dados",
    compartilhamento: "pessoal",
    tamanhoCard: "compacto",
  },
  vendas: {
    nome: "Vendas",
    tipo: "Contagem",
    periodo: "Mês atual",
    formulaNumerador: "Vendas",
    formulaDenominador: "",
    multiplicador: "1",
    exibicaoSemDados: "Sem dados",
    compartilhamento: "empresa",
    tamanhoCard: "compacto",
  },
  recebido: {
    nome: "Recebido",
    tipo: "Monetário (R$)",
    periodo: "Mês atual",
    formulaNumerador: "Receita recebida",
    formulaDenominador: "",
    multiplicador: "1",
    exibicaoSemDados: "Sem dados",
    compartilhamento: "empresa",
    tamanhoCard: "compacto",
  },
  vendas_por_semana: {
    nome: "Vendas por semana",
    tipo: "Série temporal",
    periodo: "Últimas 4 semanas",
    formulaNumerador: "Vendas",
    formulaDenominador: "",
    multiplicador: "1",
    exibicaoSemDados: "Sem dados",
    compartilhamento: "pessoal",
    tamanhoCard: "largo",
  },
};
