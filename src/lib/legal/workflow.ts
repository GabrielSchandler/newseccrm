export type LegalWorkflowStage =
  | "termo_pagamento_servico"
  | "lgpd_hipossuficiencia_procuracao"
  | "diligencia_cobranca"
  | "pagamento_laudo"
  | "pos_laudo_ciencia";

export type LegalWorkflowStageDefinition = {
  id: string;
  value: string;
  legacyKey: LegalWorkflowStage | null;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  documents: string[];
  position: number;
};

export const legalWorkflowStages: Array<LegalWorkflowStageDefinition> = [
  {
    id: "termo_pagamento_servico",
    value: "termo_pagamento_servico",
    legacyKey: "termo_pagamento_servico",
    label: "1. Termo de pagamento de prestacao de servico",
    shortLabel: "Termo de pagamento",
    description:
      "Entrada do cliente no Juridico com o termo comercial de pagamento de prestacao de servico.",
    color: "#0f766e",
    documents: ["Termo de pagamento de prestacao de servico"],
    position: 1,
  },
  {
    id: "lgpd_hipossuficiencia_procuracao",
    value: "lgpd_hipossuficiencia_procuracao",
    legacyKey: "lgpd_hipossuficiencia_procuracao",
    label: "2. LGPD, hipossuficiencia e procuracao",
    shortLabel: "LGPD e procuracao",
    description:
      "Reunir e emitir os documentos de consentimento, hipossuficiencia e procuracao ad judicia.",
    color: "#0369a1",
    documents: [
      "Termo LGPD",
      "Declaracao de Hipossuficiencia",
      "Procuracao Ad Judicia",
    ],
    position: 2,
  },
  {
    id: "diligencia_cobranca",
    value: "diligencia_cobranca",
    legacyKey: "diligencia_cobranca",
    label: "3. Diligencia para cobranca",
    shortLabel: "Diligencia e cobranca",
    description:
      "Emitir os documentos de diligencia e formalizacao da cobranca extrajudicial.",
    color: "#7c3aed",
    documents: [
      "Notificacao Extrajudicial",
      "Protocolo de Formalizacao",
      "Comunicado de Designacao de Perito",
    ],
    position: 3,
  },
  {
    id: "pagamento_laudo",
    value: "pagamento_laudo",
    legacyKey: "pagamento_laudo",
    label: "4. Pagamento de laudo",
    shortLabel: "Pagamento de laudo",
    description:
      "Controlar o documento da etapa em que o cliente realiza o pagamento do laudo.",
    color: "#b45309",
    documents: ["Termo de Pagamento de Laudo"],
    position: 4,
  },
  {
    id: "pos_laudo_ciencia",
    value: "pos_laudo_ciencia",
    legacyKey: "pos_laudo_ciencia",
    label: "5. Pos recebimento do laudo",
    shortLabel: "Pos-laudo",
    description:
      "Registrar a etapa final de ciencia e responsabilidade apos o recebimento do laudo.",
    color: "#be123c",
    documents: ["Termo de Ciencia e Responsabilidade"],
    position: 5,
  },
];

export const legalWorkflowStageOptions = legalWorkflowStages.map((stage) => ({
  value: stage.value,
  label: stage.label,
}));

export function getLegalWorkflowStage(
  stage: string | null | undefined,
  stages: LegalWorkflowStageDefinition[] = legalWorkflowStages,
) {
  return (
    stages.find(
      (item) =>
        item.id === stage ||
        item.value === stage ||
        item.legacyKey === stage,
    ) ??
    stages[0] ??
    legalWorkflowStages[0]
  );
}

export function normalizeLegalWorkflowStage(
  stage: string | null | undefined,
): LegalWorkflowStage {
  return getLegalWorkflowStage(stage).legacyKey ?? "termo_pagamento_servico";
}

export function mapLegalWorkflowStageRow(row: {
  id: string;
  legacy_key?: string | null;
  title: string;
  short_title: string;
  description: string;
  color?: string | null;
  expected_documents?: string[] | null;
  position: number;
}): LegalWorkflowStageDefinition {
  const legacyKey = legalWorkflowStages.some(
    (stage) => stage.legacyKey === row.legacy_key,
  )
    ? (row.legacy_key as LegalWorkflowStage)
    : null;

  return {
    id: row.id,
    value: row.id,
    legacyKey,
    label: `${row.position}. ${row.title}`,
    shortLabel: row.short_title,
    description: row.description,
    color: row.color ?? "#0f766e",
    documents: row.expected_documents ?? [],
    position: row.position,
  };
}
