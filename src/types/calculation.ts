export type FinancingCalculationStatus = "calculado" | "pdf_gerado";
export type FinancingCalculationType = "emprestimo" | "veiculo" | "imovel";

export type FinancingCalculation = {
  id: string;
  company_id: string;
  client_id: string | null;
  pre_sale_id: string | null;
  simulation_type: FinancingCalculationType | null;
  client_name: string;
  client_cpf: string;
  client_phone: string | null;
  financial_institution: string | null;
  specialist_name: string | null;
  situation: string | null;
  expires_in: string | null;
  attendance_date: string | null;
  vehicle: string | null;
  vehicle_year: string | null;
  administrative_fee: number | string | null;
  insurance_value: number | string | null;
  notes: string | null;
  cash_value: number | string | null;
  down_payment: number | string | null;
  financed_value: number | string | null;
  installment_count: number | string | null;
  current_installment_value: number | string | null;
  paid_installments: number | string | null;
  remaining_installments: number | string | null;
  installment_reduction_percentage: number | string | null;
  corrected_installment_value: number | string | null;
  current_total_financing: number | string | null;
  corrected_total_financing: number | string | null;
  abusive_interest_per_installment: number | string | null;
  paid_amount_until_now: number | string | null;
  abusive_interest_paid: number | string | null;
  remaining_amount_to_pay: number | string | null;
  real_debt: number | string | null;
  settlement_discount_percentage: number | string | null;
  settlement_amount: number | string | null;
  estimated_savings: number | string | null;
  installment_reduction_remaining: number | string | null;
  discount_30_value: number | string | null;
  discount_90_value: number | string | null;
  debt_after_30_discount: number | string | null;
  debt_after_90_discount: number | string | null;
  example_50_discount_15x: number | string | null;
  example_50_discount_10x: number | string | null;
  example_50_discount_5x: number | string | null;
  protocol_number: string | null;
  pdf_storage_path: string | null;
  pdf_file_name: string | null;
  summary_image_storage_path: string | null;
  summary_image_file_name: string | null;
  status: FinancingCalculationStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CalculationClientOption = {
  id: string;
  full_name: string;
  cpf: string;
  phone_mobile: string;
};

export type CalculationPreSaleOption = {
  id: string;
  client_id: string;
  pre_sale_type: FinancingCalculationType;
  label: string;
  client_name: string;
  client_cpf: string;
  client_phone: string | null;
  financial_institution: string | null;
  specialist_name: string | null;
  vehicle: string | null;
  vehicle_year: string | null;
  financed_value: number | null;
  down_payment: number | null;
  current_installment_value: number | null;
  paid_installments: number | null;
  remaining_installments: number | null;
};

export type FinancingCalculationComputedValues = {
  corrected_installment_value: number;
  current_total_financing: number;
  corrected_total_financing: number;
  abusive_interest_per_installment: number;
  paid_amount_until_now: number;
  abusive_interest_paid: number;
  remaining_amount_to_pay: number;
  real_debt: number;
  settlement_amount: number | null;
  estimated_savings: number;
  installment_reduction_remaining: number;
  discount_30_value: number;
  discount_90_value: number;
  debt_after_30_discount: number;
  debt_after_90_discount: number;
  example_50_discount_15x: number;
  example_50_discount_10x: number;
  example_50_discount_5x: number;
};

export const financingCalculationStatuses: Array<{
  value: FinancingCalculationStatus;
  label: string;
}> = [
  { value: "calculado", label: "Simulada" },
  { value: "pdf_gerado", label: "PDF gerado" },
];

export const financingCalculationTypes: Array<{
  value: FinancingCalculationType;
  label: string;
}> = [
  { value: "emprestimo", label: "Empréstimo" },
  { value: "veiculo", label: "Veículo" },
  { value: "imovel", label: "Imóvel" },
];
