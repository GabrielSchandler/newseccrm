export type CompanyAuditLog = {
  id: string;
  company_id: string;
  user_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
