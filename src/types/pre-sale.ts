import type { Client } from "@/types/client";

export type PreSaleStatus =
  | "lead"
  | "pre_venda"
  | "em_contato"
  | "em_negociacao"
  | "aprovado"
  | "perdido";

export type PreSaleType = "emprestimo" | "imovel" | "veiculo";

export type UserProfileOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export type ClientOption = Pick<Client, "id" | "full_name" | "cpf" | "phone_mobile">;

export type PreSale = {
  id: string;
  company_id: string;
  client_id: string;
  consultant_user_id: string | null;
  pre_sale_type: PreSaleType;
  status: PreSaleStatus;
  service_type: string | null;
  estimated_contract_value: number | string | null;
  negotiation_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
};

export type PreSaleFinancialCase = {
  id?: string;
  pre_sale_id: string;
  asset_brand_model: string | null;
  asset_color: string | null;
  asset_year: string | number | null;
  asset_plate: string | null;
};

export type PreSaleWithRelations = PreSale & {
  client: ClientOption | null;
  consultant: UserProfileOption | null;
  creator?: UserProfileOption | null;
};

export const preSaleStatuses: Array<{
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

export const preSaleTypes: Array<{
  value: PreSaleType;
  label: string;
}> = [
  { value: "emprestimo", label: "Emprestimo" },
  { value: "imovel", label: "Imovel" },
  { value: "veiculo", label: "Veiculo" },
];
