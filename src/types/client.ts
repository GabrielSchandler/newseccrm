export type Client = {
  id: string;
  company_id: string;
  full_name: string;
  cpf: string;
  rg: string | null;
  nationality: string | null;
  birth_date: string | null;
  marital_status: string | null;
  profession: string | null;
  email: string | null;
  phone_mobile: string;
  phone_secondary: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  legal_responsible_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type ClientAuditUser = {
  id?: string;
  full_name: string | null;
  nickname?: string | null;
  username: string | null;
  email: string | null;
};

export type ClientListItem = Pick<
  Client,
  | "id"
  | "full_name"
  | "cpf"
  | "phone_mobile"
  | "city"
  | "state"
  | "created_at"
  | "deleted_at"
>;
