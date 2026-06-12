import type { Client } from "@/types/client";
import type { LegalWorkflowStage } from "@/lib/legal/workflow";

export type PreSaleStatus =
  | "lead"
  | "pre_venda"
  | "em_contato"
  | "em_negociacao"
  | "aprovado"
  | "perdido"
  | "inativo"
  | "distrato";

export type PreSaleType = "emprestimo" | "imovel" | "veiculo";
export type LeadMedia = "Soul" | "Growper" | "Prosperity";

export type UserProfileOption = {
  id: string;
  full_name: string | null;
  nickname?: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  business_area?: string | null;
  is_active?: boolean | null;
  legal_role?: string | null;
};

export type ClientSnapshotFields = {
  full_name: string;
  cpf: string;
  rg: string | null;
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
};

export type DebtHolder = {
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  marital_status: string | null;
  profession: string | null;
  nationality: string | null;
  issuer_agency: string | null;
  father_name: string | null;
  mother_name: string | null;
  phone_mobile: string | null;
  phone_secondary: string | null;
  email: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

export type ClientOption = Pick<Client, "id"> & ClientSnapshotFields;

export type PreSale = {
  id: string;
  company_id: string;
  client_id: string;
  consultant_user_id: string | null;
  pre_sale_type: PreSaleType;
  status: PreSaleStatus;
  service_type: string | null;
  media: string | null;
  contract_value: number | string | null;
  payment_description: string | null;
  negotiation_details: string | null;
  legal_department: string | null;
  legal_status_text: string | null;
  legal_document_status: string | null;
  legal_case_number: string | null;
  legal_case_year: string | null;
  legal_deadline: string | null;
  legal_county: string | null;
  legal_forum: string | null;
  legal_court_division: string | null;
  legal_operator_name: string | null;
  legal_process_operator_name: string | null;
  legal_protocol: string | null;
  legacy_source: string | null;
  legacy_external_id: string | null;
  legal_stage: LegalWorkflowStage | null;
  legal_stage_updated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
};

export type PreSaleClientSnapshot = ClientSnapshotFields & {
  pre_sale_id: string;
};

export type PreSaleDebtHolder = DebtHolder & {
  pre_sale_id: string;
};

export type PreSaleFinancialCase = {
  id?: string;
  pre_sale_id: string;
  financer_name: string | null;
  financer_legal_name: string | null;
  financer_cnpj: string | null;
  financer_address: string | null;
  financer_district: string | null;
  financer_zip_code: string | null;
  financer_city: string | null;
  financer_state: string | null;
  has_financing_contract: boolean | null;
  financed_amount: number | string | null;
  installment_amount: number | string | null;
  paid_installments: number | string | null;
  overdue_installments: number | string | null;
  due_day: number | string | null;
  contract_number: string | null;
  asset_brand_model: string | null;
  asset_color: string | null;
  asset_year: string | number | null;
  asset_plate: string | null;
};

export type PreSalePayment = {
  id?: string;
  pre_sale_id?: string;
  installment_number: number | string | null;
  amount: number | string | null;
  goal_amount: number | string | null;
  payment_method: string | null;
  payment_date: string | null;
  status: string | null;
};

export type PreSaleWithRelations = PreSale & {
  client: ClientOption | null;
  consultant: UserProfileOption | null;
  creator?: UserProfileOption | null;
};

export const preSalePipelineStatuses: Array<{
  value: PreSaleStatus;
  label: string;
}> = [
  { value: "lead", label: "Lead" },
  { value: "pre_venda", label: "Pre-venda" },
  { value: "em_contato", label: "Em contato" },
  { value: "em_negociacao", label: "Em negociacao" },
  { value: "aprovado", label: "Aprovado" },
  { value: "perdido", label: "Perdido" },
];

export const preSaleArchivedStatuses: Array<{
  value: Extract<PreSaleStatus, "inativo" | "distrato">;
  label: string;
}> = [
  { value: "inativo", label: "Inativo" },
  { value: "distrato", label: "Distrato" },
];

export const preSaleStatuses = [
  ...preSalePipelineStatuses,
  ...preSaleArchivedStatuses,
];

export function isArchivedPreSaleStatus(status: PreSaleStatus | string | null | undefined) {
  return status === "inativo" || status === "distrato";
}

export const preSaleTypes: Array<{
  value: PreSaleType;
  label: string;
}> = [
  { value: "emprestimo", label: "Emprestimo" },
  { value: "imovel", label: "Imovel" },
  { value: "veiculo", label: "Veiculo" },
];

export const leadMediaOptions: Array<{
  value: LeadMedia;
  label: string;
}> = [
  { value: "Soul", label: "Soul" },
  { value: "Growper", label: "Growper" },
  { value: "Prosperity", label: "Prosperity" },
];
