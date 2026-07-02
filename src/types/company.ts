export type CompanyProfile = {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  logo_path: string | null;
  logo_file_name: string | null;
  simulation_guarantee_title: string | null;
  simulation_guarantee_lead: string | null;
  simulation_guarantee_clause_label: string | null;
  simulation_guarantee_clause_text: string | null;
  user_license_limit: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanyPlatformStatus = "active" | "trial" | "suspended" | "cancelled";

export type CompanyPlatformSettings = {
  company_id: string;
  status: CompanyPlatformStatus | string | null;
  storage_limit_mb: number | null;
  enable_commercial: boolean | null;
  enable_legal: boolean | null;
  enable_finance: boolean | null;
  enable_academy: boolean | null;
  enable_lead_distribution: boolean | null;
  enable_client_portal: boolean | null;
  enable_backups: boolean | null;
  enable_outlook_email: boolean | null;
  enable_simulations: boolean | null;
  enable_documents: boolean | null;
  enable_custom_templates: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};
