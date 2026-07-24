export type TotalkIntegration = {
  id: string;
  company_id: string;
  api_base_url: string;
  encrypted_api_token: string;
  default_sender_phone: string | null;
  default_send_message: string | null;
  is_active: boolean | null;
  connected_by: string | null;
  last_import_at: string | null;
  last_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TotalkIntegrationStatus = {
  id: string;
  apiBaseUrl: string;
  defaultSenderPhone: string | null;
  defaultSendMessage: string | null;
  isActive: boolean;
  lastImportAt: string | null;
  lastSentAt: string | null;
  updatedAt: string | null;
};
