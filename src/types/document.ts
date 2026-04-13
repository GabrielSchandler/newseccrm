export type DocumentTemplateType =
  | "ordem_servico"
  | "contrato"
  | "aditivo"
  | "declaracao"
  | "procuracao"
  | "outro";

export type DocumentTemplate = {
  id: string;
  company_id: string;
  name: string;
  document_type: DocumentTemplateType;
  description: string | null;
  content_html: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type GeneratedDocumentStatus = "gerado" | "rascunho" | "cancelado";

export type GeneratedDocument = {
  id: string;
  company_id: string;
  pre_sale_id: string;
  client_id: string | null;
  template_id: string;
  document_type: DocumentTemplateType;
  title: string;
  rendered_content_html: string;
  rendered_variables: Record<string, string> | null;
  status: GeneratedDocumentStatus;
  created_by: string | null;
  created_at: string;
};

export const documentTemplateTypes: Array<{
  value: DocumentTemplateType;
  label: string;
}> = [
  { value: "ordem_servico", label: "Ordem de servico" },
  { value: "contrato", label: "Contrato" },
  { value: "aditivo", label: "Aditivo" },
  { value: "declaracao", label: "Declaracao" },
  { value: "procuracao", label: "Procuracao" },
  { value: "outro", label: "Outro" },
];

export const documentStatusLabels: Record<GeneratedDocumentStatus, string> = {
  gerado: "Gerado",
  rascunho: "Rascunho",
  cancelado: "Cancelado",
};
