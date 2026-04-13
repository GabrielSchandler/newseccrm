export type DocumentTemplateType = "contrato" | "ordem_servico";

export type DocumentTemplate = {
  id: string;
  company_id: string;
  name: string;
  type: DocumentTemplateType;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type GeneratedDocument = {
  id: string;
  company_id: string;
  pre_sale_id: string;
  template_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type GeneratedDocumentListItem = GeneratedDocument & {
  template: DocumentTemplate | null;
  clientName: string | null;
};

export const documentTemplateTypes: Array<{
  value: DocumentTemplateType;
  label: string;
}> = [
  { value: "contrato", label: "Contrato" },
  { value: "ordem_servico", label: "Ordem de servico" },
];
