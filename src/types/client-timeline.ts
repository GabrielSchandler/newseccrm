export type ClientTimelineEventType =
  | "client_created"
  | "client_updated"
  | "pre_sale_created"
  | "pre_sale_updated"
  | "pre_sale_status_updated"
  | "legal_stage_updated"
  | "client_document_uploaded"
  | "client_document_updated"
  | "client_document_replaced"
  | "client_document_deleted"
  | "email_draft_created"
  | "email_sent"
  | "calculation_imported_from_totalk"
  | "calculation_pdf_sent_totalk"
  | "legal_payment_created"
  | "legal_payment_updated"
  | "legal_payment_deleted"
  | "legal_payment_receipt_generated"
  | "tracking_update_created"
  | "tracking_update_updated"
  | "tracking_update_deleted"
  | "manual_note";

export type ClientTimelineEvent = {
  id: string;
  company_id: string;
  client_id: string;
  pre_sale_id: string | null;
  event_type: ClientTimelineEventType;
  title: string;
  note: string | null;
  actor_user_profile_id: string | null;
  actor_role: string | null;
  actor_business_area: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
