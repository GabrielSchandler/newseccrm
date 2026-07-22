import type { LegalWorkflowStage } from "@/lib/legal/workflow";

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
  legal_stage: LegalWorkflowStage | null;
  legal_stage_id?: string | null;
  description: string | null;
  content_html: string;
  original_docx_path: string | null;
  original_docx_filename: string | null;
  original_docx_size: number | null;
  original_docx_uploaded_at: string | null;
  original_pdf_path: string | null;
  original_pdf_filename: string | null;
  original_pdf_size: number | null;
  original_pdf_uploaded_at: string | null;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type GeneratedDocumentStatus =
  | "gerado"
  | "rascunho"
  | "cancelado"
  | "pdf_error"
  | "erro";

export type DocumentRenderSource = "html" | "docx" | "pdf";

export type GeneratedDocument = {
  id: string;
  company_id: string;
  pre_sale_id: string;
  client_id: string | null;
  template_id: string;
  legal_payment_id?: string | null;
  document_type: DocumentTemplateType;
  title: string;
  rendered_content_html: string;
  rendered_variables: Record<string, string> | null;
  generated_docx_path: string | null;
  generated_pdf_path: string | null;
  generated_docx_filename: string | null;
  generated_pdf_filename: string | null;
  render_source: DocumentRenderSource | null;
  pdf_error_message: string | null;
  status: GeneratedDocumentStatus;
  created_by: string | null;
  created_at: string;
};

export const documentTemplateTypes: Array<{
  value: DocumentTemplateType;
  label: string;
}> = [
  { value: "ordem_servico", label: "Ordem de serviço" },
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
  pdf_error: "DOCX gerado, PDF pendente",
  erro: "Erro",
};
