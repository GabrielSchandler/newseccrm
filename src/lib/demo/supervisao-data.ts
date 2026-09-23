/**
 * Dados sinteticos do modo de demonstracao de /supervisao (Fase 1).
 * Nada aqui vem de banco real.
 */

export const abasSupervisaoDemo = ["Visão geral", "Conversas", "Disparos", "Treinar equipe"];

export type FilaEstado = "Aguardando" | "Em atendimento";
export type FilaTipo = "Humano" | "IA";

export type ItemFila = {
  id: string;
  cliente: string;
  trecho: string;
  canal: "WhatsApp" | "E-mail" | "Instagram" | "Chat";
  setor: "Comercial" | "Jurídico";
  responsavel: string | null;
  esperaMinutos: number;
  estado: FilaEstado;
  tipo: FilaTipo;
};

export const filaOperacionalDemo: ItemFila[] = [
  { id: "f1", cliente: "Mariana Lima", trecho: "Quero saber sobre meu pedido...", canal: "WhatsApp", setor: "Comercial", responsavel: null, esperaMinutos: 18, estado: "Aguardando", tipo: "Humano" },
  { id: "f2", cliente: "Rafael Souza", trecho: "O produto chegou com defeito...", canal: "E-mail", setor: "Comercial", responsavel: "Ana", esperaMinutos: 4, estado: "Em atendimento", tipo: "Humano" },
  { id: "f3", cliente: "Camila Pereira", trecho: "Vocês têm essa cor em estoque?", canal: "Instagram", setor: "Comercial", responsavel: null, esperaMinutos: 1, estado: "Em atendimento", tipo: "IA" },
  { id: "f4", cliente: "Thiago Fernandes", trecho: "Gostaria de cancelar minha compra...", canal: "WhatsApp", setor: "Jurídico", responsavel: null, esperaMinutos: 25, estado: "Aguardando", tipo: "Humano" },
  { id: "f5", cliente: "Letícia Alves", trecho: "Qual o prazo de entrega para...", canal: "Chat", setor: "Comercial", responsavel: "Bruno", esperaMinutos: 3, estado: "Em atendimento", tipo: "Humano" },
  { id: "f6", cliente: "Gabriel Costa", trecho: "Preciso de nota fiscal da minha...", canal: "Instagram", setor: "Comercial", responsavel: "Carla", esperaMinutos: 11, estado: "Aguardando", tipo: "Humano" },
];

export type ConsultorCarga = {
  id: string;
  nome: string;
  iniciais: string;
  emAtendimento: number;
  maisAntigoMinutos: number;
  disponivel: boolean;
  capacidadePercent: number;
};

export const cargaEquipeDemo: ConsultorCarga[] = [
  { id: "ana", nome: "Ana", iniciais: "A", emAtendimento: 5, maisAntigoMinutos: 14, disponivel: true, capacidadePercent: 83 },
  { id: "bruno", nome: "Bruno", iniciais: "B", emAtendimento: 4, maisAntigoMinutos: 6, disponivel: true, capacidadePercent: 67 },
  { id: "carla", nome: "Carla", iniciais: "C", emAtendimento: 6, maisAntigoMinutos: 22, disponivel: false, capacidadePercent: 100 },
  { id: "diego", nome: "Diego", iniciais: "D", emAtendimento: 3, maisAntigoMinutos: 9, disponivel: true, capacidadePercent: 50 },
  { id: "elisa", nome: "Elisa", iniciais: "E", emAtendimento: 2, maisAntigoMinutos: 4, disponivel: true, capacidadePercent: 40 },
];

export const indicadoresSupervisaoDemo = {
  aguardandoHumano: filaOperacionalDemo.filter((i) => i.estado === "Aguardando" && i.tipo === "Humano").length,
  semResponsavel: filaOperacionalDemo.filter((i) => !i.responsavel).length,
  emAtendimento: filaOperacionalDemo.filter((i) => i.estado === "Em atendimento").length,
  iaAtiva: filaOperacionalDemo.filter((i) => i.tipo === "IA").length,
};

export const atencaoNecessariaDemo = [
  {
    id: "a1",
    icone: "clock" as const,
    titulo: "Thiago Fernandes",
    descricao: "Aguardando há 25 minutos. Cliente deseja cancelar e ainda não tem responsável.",
    acaoLabel: "Atribuir agora",
  },
  {
    id: "a2",
    icone: "semResponsavel" as const,
    titulo: "Sem responsável",
    descricao: "4 atendimentos na fila sem ninguém designado no momento.",
    acaoLabel: "Distribuir",
  },
];

export const tempoRespostaSeriesDemo = [
  { hora: "00h", minutos: 6 },
  { hora: "02h", minutos: 4 },
  { hora: "04h", minutos: 3 },
  { hora: "06h", minutos: 3 },
  { hora: "08h", minutos: 9 },
  { hora: "10h", minutos: 14 },
  { hora: "12h", minutos: 11 },
  { hora: "14h", minutos: 13 },
  { hora: "16h", minutos: 10 },
  { hora: "18h", minutos: 7 },
  { hora: "20h", minutos: 8 },
];

export const tempoMedioHojeDemo = { minutos: 8, variacaoPercent: -32 };
