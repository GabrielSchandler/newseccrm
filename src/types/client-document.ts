export type ClientDocumentType =
  | "rg"
  | "cpf"
  | "cnh"
  | "comprovante_residencia"
  | "contrato_assinado"
  | "procuracao"
  | "documento_financiamento"
  | "outro";

export type ClientDocument = {
  id: string;
  company_id: string;
  client_id: string;
  pre_sale_id: string | null;
  document_type: ClientDocumentType;
  title: string | null;
  description: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export const clientDocumentTypes: Array<{
  value: ClientDocumentType;
  label: string;
}> = [
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "cnh", label: "CNH" },
  { value: "comprovante_residencia", label: "Comprovante de residencia" },
  { value: "contrato_assinado", label: "Contrato assinado" },
  { value: "procuracao", label: "Procuracao" },
  { value: "documento_financiamento", label: "Documento de financiamento" },
  { value: "outro", label: "Outro" },
];
