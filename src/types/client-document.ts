import type { ClientApprovalStatus } from "@/types/client-approval";

export type ClientDocumentType =
  | "documentacao"
  | "extrajudicial"
  | "processual";

export type LegacyClientDocumentType =
  | "rg"
  | "cpf"
  | "cnh"
  | "comprovante_residencia"
  | "contrato_assinado"
  | "procuracao"
  | "documento_financiamento"
  | "outro";

export type ClientDocumentStoredType =
  | ClientDocumentType
  | LegacyClientDocumentType
  | (string & {});

export type ClientDocument = {
  id: string;
  company_id: string;
  client_id: string;
  pre_sale_id: string | null;
  document_type: ClientDocumentStoredType;
  title: string | null;
  description: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number;
  uploaded_by: string | null;
  client_visibility_requested: boolean;
  client_download_requested: boolean;
  client_access_status: ClientApprovalStatus;
  client_access_requested_by: string | null;
  client_access_requested_at: string | null;
  client_access_reviewed_by: string | null;
  client_access_reviewed_at: string | null;
  client_access_review_note: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export const clientDocumentAcceptedFormatsLabel =
  "PDF, JPG, PNG, WEBP, DOC, DOCX, WAV e MSG";

export const clientDocumentAcceptedInputTypes = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".wav",
  ".msg",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/vnd.wave",
  "application/vnd.ms-outlook",
  "application/msg",
  "application/x-msg",
].join(",");

export const clientDocumentTypes: Array<{
  value: ClientDocumentType;
  label: string;
}> = [
  { value: "documentacao", label: "Documentação" },
  { value: "extrajudicial", label: "Extrajudicial" },
  { value: "processual", label: "Processual" },
];

export function normalizeClientDocumentType(
  value: ClientDocumentStoredType | string | null | undefined,
): ClientDocumentType {
  return clientDocumentTypes.some((type) => type.value === value)
    ? (value as ClientDocumentType)
    : "documentacao";
}
