export type LegalWorkflowStage =
  | "termo_pagamento_servico"
  | "lgpd_hipossuficiencia_procuracao"
  | "diligencia_cobranca"
  | "pagamento_laudo"
  | "pos_laudo_ciencia";

export const legalWorkflowStages: Array<{
  value: LegalWorkflowStage;
  label: string;
  shortLabel: string;
  description: string;
  documents: string[];
}> = [
  {
    value: "termo_pagamento_servico",
    label: "1. Termo de pagamento de prestacao de servico",
    shortLabel: "Termo de pagamento",
    description:
      "Entrada do cliente no Juridico com o termo comercial de pagamento de prestacao de servico.",
    documents: ["Termo de pagamento de prestacao de servico"],
  },
  {
    value: "lgpd_hipossuficiencia_procuracao",
    label: "2. LGPD, hipossuficiencia e procuracao",
    shortLabel: "LGPD e procuracao",
    description:
      "Reunir e emitir os documentos de consentimento, hipossuficiencia e procuracao ad judicia.",
    documents: [
      "Termo LGPD",
      "Declaracao de Hipossuficiencia",
      "Procuracao Ad Judicia",
    ],
  },
  {
    value: "diligencia_cobranca",
    label: "3. Diligencia para cobranca",
    shortLabel: "Diligencia e cobranca",
    description:
      "Emitir os documentos de diligencia e formalizacao da cobranca extrajudicial.",
    documents: [
      "Notificacao Extrajudicial",
      "Protocolo de Formalizacao",
      "Comunicado de Designacao de Perito",
    ],
  },
  {
    value: "pagamento_laudo",
    label: "4. Pagamento de laudo",
    shortLabel: "Pagamento de laudo",
    description:
      "Controlar o documento da etapa em que o cliente realiza o pagamento do laudo.",
    documents: ["Termo de Pagamento de Laudo"],
  },
  {
    value: "pos_laudo_ciencia",
    label: "5. Pos recebimento do laudo",
    shortLabel: "Pos-laudo",
    description:
      "Registrar a etapa final de ciencia e responsabilidade apos o recebimento do laudo.",
    documents: ["Termo de Ciencia e Responsabilidade"],
  },
];

export const legalWorkflowStageOptions = legalWorkflowStages.map((stage) => ({
  value: stage.value,
  label: stage.label,
}));

export function getLegalWorkflowStage(
  stage: string | null | undefined,
) {
  return (
    legalWorkflowStages.find((item) => item.value === stage) ??
    legalWorkflowStages[0]
  );
}

export function normalizeLegalWorkflowStage(
  stage: string | null | undefined,
): LegalWorkflowStage {
  return getLegalWorkflowStage(stage).value;
}
