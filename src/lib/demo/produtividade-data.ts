/**
 * Dados sinteticos do modo de demonstracao de /produtividade (Fase 1).
 * Nada aqui vem de telemetria real — inclui o aviso "Dados ilustrativos"
 * explicito na tela, como o Focus real ja faz.
 */

export const cardsProdutividadeDemo = [
  { rotulo: "Jornada prevista", valor: "40h" },
  { rotulo: "Tempo ativo", valor: "32h" },
  { rotulo: "Tempo produtivo", valor: "26h" },
  { rotulo: "Cobertura", valor: "90%" },
];

export const distribuicaoJornadaDemo = [
  { categoria: "Produtivo", percent: 65, cor: "var(--ns-success)" },
  { categoria: "Neutro", percent: 10, cor: "var(--ns-primary)" },
  { categoria: "Improdutivo", percent: 5, cor: "var(--ns-warning)" },
  { categoria: "Ocioso", percent: 10, cor: "var(--ns-text-secondary)" },
  { categoria: "Sem dados", percent: 10, cor: "var(--ns-border)" },
];

export const aplicativosDemo = [
  { nome: "Sistema CRM", tempo: "14h" },
  { nome: "Planilhas", tempo: "6h" },
  { nome: "Navegador", tempo: "4h" },
];

export const pessoasEquipeDemo = [
  { nome: "Ana Cardoso", iniciais: "AC", jornada: "40h", ativo: "32h", produtivo: "26h", ocioso: "4h", cobertura: "90%" },
  { nome: "Bruno Ribeiro", iniciais: "BR", jornada: "40h", ativo: "32h", produtivo: "26h", ocioso: "4h", cobertura: "90%" },
  { nome: "Carla Lima", iniciais: "CL", jornada: "40h", ativo: "32h", produtivo: "26h", ocioso: "4h", cobertura: "90%" },
  { nome: "Diego Santos", iniciais: "DS", jornada: "40h", ativo: "32h", produtivo: "26h", ocioso: "4h", cobertura: "90%" },
  { nome: "Elisa Nascimento", iniciais: "EN", jornada: "40h", ativo: "32h", produtivo: "26h", ocioso: "4h", cobertura: "90%" },
];
