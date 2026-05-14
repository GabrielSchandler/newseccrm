import type { LegalWorkflowStage } from "@/lib/legal/workflow";

export type EmailRecipientMode = "client" | "bank" | "client_bank" | "custom";
export type EmailDispatchMode = "draft" | "send";
export type EmailLogStatus = "draft_created" | "sent" | "error";

export type EmailIntegration = {
  id: string;
  company_id: string;
  user_profile_id: string;
  provider: "microsoft" | string;
  provider_user_id: string | null;
  email: string;
  display_name: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  connected_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EmailTemplate = {
  id: string;
  company_id: string;
  name: string;
  business_area: "commercial" | "legal" | string;
  legal_stage: LegalWorkflowStage | null;
  recipient_mode: EmailRecipientMode;
  subject_template: string;
  body_template: string;
  cc_template: string | null;
  bcc_template: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EmailLog = {
  id: string;
  company_id: string;
  client_id: string;
  pre_sale_id: string | null;
  template_id: string | null;
  legal_stage: LegalWorkflowStage | null;
  sender_user_profile_id: string | null;
  action_by_user_profile_id: string | null;
  sender_email: string;
  mode: EmailDispatchMode;
  status: EmailLogStatus;
  subject: string;
  body: string;
  recipients: Record<string, unknown>;
  attachments: Array<Record<string, unknown>>;
  microsoft_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

export const emailRecipientModes: Array<{
  value: EmailRecipientMode;
  label: string;
}> = [
  { value: "client", label: "Cliente" },
  { value: "bank", label: "Banco" },
  { value: "client_bank", label: "Cliente e banco" },
  { value: "custom", label: "Personalizado" },
];

export const emailDispatchModes: Array<{
  value: EmailDispatchMode;
  label: string;
}> = [
  { value: "draft", label: "Criar rascunho" },
  { value: "send", label: "Enviar agora" },
];

export function formatEmailRecipientMode(mode: EmailRecipientMode | string | null) {
  return emailRecipientModes.find((item) => item.value === mode)?.label ?? "Personalizado";
}
