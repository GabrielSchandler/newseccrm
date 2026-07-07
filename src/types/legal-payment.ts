export type LegalPaymentStatus = "previsto" | "pago" | "vencido" | "cancelado";

export type LegalPaymentType = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
};

export type LegalCommissionTier = {
  id: string;
  company_id: string;
  min_goal_amount: number | string;
  commission_percent: number | string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type LegalPayment = {
  id: string;
  company_id: string;
  pre_sale_id: string;
  client_id: string;
  legal_payment_type_id: string;
  responsible_user_id: string | null;
  installment_number: number | string;
  description: string | null;
  amount: number | string;
  goal_amount: number | string;
  payment_method: string | null;
  due_date: string | null;
  paid_at: string | null;
  status: LegalPaymentStatus;
  finance_transaction_id: string | null;
  finance_sale_id: string | null;
  receipt_generated_document_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export const legalPaymentStatuses: Array<{
  value: LegalPaymentStatus;
  label: string;
}> = [
  { value: "previsto", label: "Previsto" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

export const legalPaymentDefaultTypeLabels = [
  "Laudo",
  "Diligencia",
  "Certidao",
  "Honorarios",
  "Acordo",
  "Taxa processual",
  "Outros",
] as const;
