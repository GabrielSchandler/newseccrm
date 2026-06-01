export type CompanyUserRole = "admin" | "manager" | "seller";
export type CompanyBusinessArea = "commercial" | "legal";
export type LegalUserRole = "admin" | "consultant";

export type CompanyUserProfile = {
  id: string;
  auth_user_id: string;
  company_id: string;
  full_name: string | null;
  nickname: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: CompanyUserRole | null;
  business_area: CompanyBusinessArea | null;
  legal_role: LegalUserRole | null;
  is_active: boolean;
  password_must_change?: boolean | null;
  password_changed_at?: string | null;
  password_reset_at?: string | null;
  password_reset_by?: string | null;
  invited_by: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export const companyUserRoles: Array<{
  value: CompanyUserRole;
  label: string;
}> = [
  { value: "admin", label: "Administrador" },
  { value: "manager", label: "Gerente" },
  { value: "seller", label: "Consultor" },
];

export const companyBusinessAreas: Array<{
  value: CompanyBusinessArea;
  label: string;
}> = [
  { value: "commercial", label: "Comercial" },
  { value: "legal", label: "Juridico" },
];

export const legalUserRoles: Array<{
  value: LegalUserRole;
  label: string;
}> = [
  { value: "admin", label: "Adm juridico" },
  { value: "consultant", label: "Consultor juridico" },
];

export function formatCompanyUserRole(role: CompanyUserRole | string | null) {
  return companyUserRoles.find((item) => item.value === role)?.label ?? "Nao informado";
}

export function formatCompanyBusinessArea(
  area: CompanyBusinessArea | string | null,
) {
  return companyBusinessAreas.find((item) => item.value === area)?.label ?? "Comercial";
}

export function formatLegalUserRole(role: LegalUserRole | string | null) {
  return legalUserRoles.find((item) => item.value === role)?.label ?? "Nao definido";
}
