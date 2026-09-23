/**
 * Dados sinteticos do modo de demonstracao do /atendimento (Fase 1).
 * Nada aqui vem de banco real. Nenhum destes nomes/telefones e real.
 * As secoes e campos do drawer de pre-venda espelham os nomes reais de
 * `src/lib/pre-sales/schema.ts` e `src/components/pre-sales/pre-sales-form.tsx`
 * (secoes: Contratante, Titular da divida, Dados financeiros, Dados
 * juridicos, Dados do veiculo, Contratacao e negociacao, Pagamentos
 * previstos) — a especificacao pede os campos reais, nao os simplificados
 * do mockup.
 */

export type ConversaEstado =
  | "IA"
  | "AGUARDANDO_HUMANO"
  | "HUMANO"
  | "AGUARDANDO_CLIENTE"
  | "ENCERRADA";

export type MensagemDemo = {
  id: string;
  autor: "cliente" | "consultor" | "sistema";
  /** Para tipo "audio", este e o texto da transcricao. */
  texto: string;
  hora: string;
  tipo?: "texto" | "documento" | "audio" | "nota";
  nomeArquivo?: string;
  /** Só para tipo "audio". */
  duracao?: string;
};

export type ConversaDemo = {
  id: string;
  nome: string;
  canal: "WhatsApp" | "Ligação registrada";
  numeroCanal: string;
  responsavel: string | null;
  estado: ConversaEstado;
  ultimaAtividade: string;
  trecho: string;
  naoLidas: number;
  esperaMinutos: number | null;
  clienteCadastrado: boolean;
  clienteDesde: string | null;
  email: string | null;
  localizacao: string | null;
  telefones: string[];
  mensagens: MensagemDemo[];
  contexto: {
    resumo: string;
    atualizadoEm: string;
    preVenda: string | null;
    posVenda: string | null;
    vendas: Array<{ servico: string; valor: string; status: string }>;
    faltantes: string[];
  };
};

export const conversasDemo: ConversaDemo[] = [
  {
    id: "c1",
    nome: "Mariana Costa",
    canal: "WhatsApp",
    numeroCanal: "Comercial 01",
    responsavel: "Você",
    estado: "HUMANO",
    ultimaAtividade: "10:24",
    trecho: "Perfeito, vou te enviar ainda hoje.",
    naoLidas: 0,
    esperaMinutos: 12,
    clienteCadastrado: true,
    clienteDesde: "jan/2024",
    email: "mariana.costa@email.com",
    localizacao: "São Paulo - SP",
    telefones: ["(11) 9 9482-4821", "(11) 9 9770-7702"],
    mensagens: [
      { id: "m1", autor: "cliente", texto: "Oi, tudo bem? Gostaria de solicitar a análise das parcelas do meu financiamento.", hora: "10:12" },
      { id: "m2", autor: "consultor", texto: "Olá, Mariana! Claro, posso ajudar. Pode me enviar o contrato do financiamento?", hora: "10:14" },
      { id: "m3", autor: "cliente", texto: "Claro! Segue o contrato.", hora: "10:16", tipo: "documento", nomeArquivo: "contrato.pdf" },
      { id: "m4", autor: "consultor", texto: "Recebido, obrigada! Vou preparar a análise e retorno ainda hoje.", hora: "10:17" },
      { id: "m5", autor: "sistema", texto: "Cliente demonstra interesse em portabilidade. Verificar condições comerciais e retorno ainda hoje.", hora: "10:20", tipo: "nota" },
      { id: "m6", autor: "cliente", texto: "então a ideia é manter as mesmas condições, mas com o ajuste no escopo, conforme falamos na reunião", hora: "10:22", tipo: "audio", duracao: "00:46" },
      { id: "m7", autor: "consultor", texto: "Perfeito, vou te enviar ainda hoje.", hora: "10:24" },
    ],
    contexto: {
      resumo: "Revisão de financiamento de veículo. Contrato recebido, análise em preparo.",
      atualizadoEm: "há 2 min",
      preVenda: "Interesse em revisão contratual — origem WhatsApp",
      posVenda: null,
      vendas: [],
      faltantes: ["Produto/serviço da pré-venda", "Origem do interesse"],
    },
  },
  {
    id: "c2",
    nome: "Rafael Almeida",
    canal: "WhatsApp",
    numeroCanal: "Comercial 02",
    responsavel: "Você",
    estado: "AGUARDANDO_CLIENTE",
    ultimaAtividade: "09:41",
    trecho: "Perfeito, muito obrigado!",
    naoLidas: 0,
    esperaMinutos: null,
    clienteCadastrado: true,
    clienteDesde: "mar/2023",
    email: "rafael.almeida@email.com",
    localizacao: "Campinas - SP",
    telefones: ["(11) 9 8123-4455"],
    mensagens: [
      { id: "m1", autor: "cliente", texto: "Consegue me confirmar amanhã?", hora: "09:38" },
      { id: "m2", autor: "consultor", texto: "Confirmo sim, te aviso pela manhã.", hora: "09:40" },
      { id: "m3", autor: "cliente", texto: "Perfeito, muito obrigado!", hora: "09:41" },
    ],
    contexto: {
      resumo: "Pré-venda em negociação, aguardando confirmação de data de assinatura.",
      atualizadoEm: "há 40 min",
      preVenda: "Revisão contratual — em negociação",
      posVenda: null,
      vendas: [],
      faltantes: [],
    },
  },
  {
    id: "c3",
    nome: "Clara Nunes",
    canal: "WhatsApp",
    numeroCanal: "Comercial 01",
    responsavel: null,
    estado: "AGUARDANDO_HUMANO",
    ultimaAtividade: "Ontem",
    trecho: "Você: Qualquer dúvida, estou à disposição.",
    naoLidas: 2,
    esperaMinutos: 340,
    clienteCadastrado: false,
    clienteDesde: null,
    email: null,
    localizacao: null,
    telefones: ["(11) 9 7011-2233"],
    mensagens: [
      { id: "m1", autor: "cliente", texto: "Boa tarde, vi o anúncio de vocês. Como funciona a análise?", hora: "Ontem 16:02" },
      { id: "m2", autor: "consultor", texto: "Boa tarde, Clara! Explico rapidinho: analisamos seu contrato em busca de juros e taxas indevidas.", hora: "Ontem 16:10" },
      { id: "m3", autor: "consultor", texto: "Qualquer dúvida, estou à disposição.", hora: "Ontem 16:11" },
    ],
    contexto: {
      resumo: "Contato ainda sem cadastro. Perguntou sobre o serviço, não enviou contrato.",
      atualizadoEm: "ontem",
      preVenda: null,
      posVenda: null,
      vendas: [],
      faltantes: ["Cadastro do cliente", "Contrato para análise"],
    },
  },
  {
    id: "c4",
    nome: "Pedro Martins",
    canal: "WhatsApp",
    numeroCanal: "Comercial 02",
    responsavel: "Você",
    estado: "IA",
    ultimaAtividade: "Seg, 14/09",
    trecho: "Documento anexado",
    naoLidas: 1,
    esperaMinutos: 8,
    clienteCadastrado: true,
    clienteDesde: "jun/2023",
    email: "pedro.martins@email.com",
    localizacao: "Ribeirão Preto - SP",
    telefones: ["(11) 9 6654-1198"],
    mensagens: [
      { id: "m1", autor: "cliente", texto: "Segue o comprovante que vocês pediram.", hora: "Seg 11:20", tipo: "documento", nomeArquivo: "comprovante.pdf" },
      { id: "m2", autor: "sistema", texto: "Assistente respondeu automaticamente: agradecimento e confirmação de recebimento.", hora: "Seg 11:21" },
    ],
    contexto: {
      resumo: "Pós-venda ativo — cliente enviando documentação complementar.",
      atualizadoEm: "seg, 14/09",
      preVenda: null,
      posVenda: "Acompanhamento de contrato em elaboração",
      vendas: [{ servico: "Revisão contratual", valor: "R$ 2.400,00", status: "Contrato em elaboração" }],
      faltantes: [],
    },
  },
  {
    id: "c5",
    nome: "Juliana Ferreira",
    canal: "Ligação registrada",
    numeroCanal: "—",
    responsavel: "Você",
    estado: "ENCERRADA",
    ultimaAtividade: "Seg, 14/09",
    trecho: "Ok, vou verificar e retorno.",
    naoLidas: 0,
    esperaMinutos: null,
    clienteCadastrado: true,
    clienteDesde: "out/2022",
    email: "juliana.ferreira@email.com",
    localizacao: "Santos - SP",
    telefones: ["(11) 9 5544-7788"],
    mensagens: [
      { id: "m1", autor: "consultor", texto: "Ligação registrada manualmente: cliente pediu prazo para reunir documentos.", hora: "Seg 15:05", tipo: "nota" },
      { id: "m2", autor: "consultor", texto: "Ok, vou verificar e retorno.", hora: "Seg 15:06" },
    ],
    contexto: {
      resumo: "Contato por ligação — sem WhatsApp. Cliente vai reunir documentos.",
      atualizadoEm: "seg, 14/09",
      preVenda: null,
      posVenda: null,
      vendas: [],
      faltantes: ["Documentos do contrato"],
    },
  },
];

export type CampoPreVenda = {
  campo: string;
  rotulo: string;
  obrigatorio: boolean;
  sugeridoPelaIa?: boolean;
  valor?: string;
};

export type SecaoPreVenda = {
  titulo: string;
  campos: CampoPreVenda[];
};

/**
 * Espelha as secoes reais de src/components/pre-sales/pre-sales-form.tsx e
 * a obrigatoriedade real de src/lib/pre-sales/schema.ts (preSaleFormSchema).
 * So os campos marcados obrigatorio=true sao de fato required no Zod; o
 * resto (inclusive Dados juridicos inteiro) e opcional no schema atual.
 */
export const secoesPreVendaDemo: SecaoPreVenda[] = [
  {
    titulo: "Contratante",
    campos: [
      { campo: "snapshot_full_name", rotulo: "Nome completo", obrigatorio: true, sugeridoPelaIa: true, valor: "Mariana Costa" },
      { campo: "snapshot_cpf", rotulo: "CPF", obrigatorio: true },
      { campo: "snapshot_rg", rotulo: "RG", obrigatorio: false },
      { campo: "snapshot_birth_date", rotulo: "Data de nascimento", obrigatorio: false },
      { campo: "snapshot_email", rotulo: "Email", obrigatorio: false },
      { campo: "snapshot_phone_mobile", rotulo: "Celular", obrigatorio: false, sugeridoPelaIa: true, valor: "(11) 9 9482-4821" },
    ],
  },
  {
    titulo: "Titular da dívida",
    campos: [
      { campo: "debt_holder_full_name", rotulo: "Nome completo (se diferente do contratante)", obrigatorio: false },
      { campo: "debt_holder_cpf", rotulo: "CPF", obrigatorio: false },
      { campo: "debt_holder_issuer_agency", rotulo: "Órgão emissor", obrigatorio: false },
    ],
  },
  {
    titulo: "Dados financeiros",
    campos: [
      { campo: "financer_name", rotulo: "Financiadora", obrigatorio: true },
      { campo: "financed_amount", rotulo: "Valor financiado", obrigatorio: false },
      { campo: "installment_amount", rotulo: "Valor da parcela", obrigatorio: false },
      { campo: "overdue_installments", rotulo: "Parcelas em atraso", obrigatorio: false },
    ],
  },
  {
    titulo: "Contratação e negociação",
    campos: [
      { campo: "pre_sale_type", rotulo: "Tipo (empréstimo/imóvel/veículo)", obrigatorio: true, sugeridoPelaIa: true, valor: "Empréstimo" },
      { campo: "contract_value", rotulo: "Valor do contrato", obrigatorio: true },
      { campo: "payment_description", rotulo: "Descrição do pagamento", obrigatorio: true },
      { campo: "media", rotulo: "Origem do lead", obrigatorio: false },
      { campo: "negotiation_details", rotulo: "Detalhes da negociação", obrigatorio: false },
    ],
  },
  {
    titulo: "Dados jurídicos",
    campos: [
      { campo: "legal_department", rotulo: "Departamento jurídico", obrigatorio: false },
      { campo: "legal_case_number", rotulo: "Número do processo", obrigatorio: false },
      { campo: "legal_forum", rotulo: "Foro", obrigatorio: false },
      { campo: "legal_deadline", rotulo: "Prazo", obrigatorio: false },
    ],
  },
  {
    titulo: "Pagamentos previstos",
    campos: [
      { campo: "payments[0]", rotulo: "1ª parcela — valor e forma de pagamento", obrigatorio: false },
      { campo: "payments[1]", rotulo: "2ª parcela — valor e forma de pagamento", obrigatorio: false },
      { campo: "payments[2]", rotulo: "3ª parcela — valor e forma de pagamento", obrigatorio: false },
    ],
  },
];
