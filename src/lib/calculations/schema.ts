import { z } from "zod";
import { formatCpf, formatPhone, isValidPhone, onlyDigits } from "@/lib/clients/masks";
import {
  formatNumberForPtBrInput,
  parseBrazilianDecimalInput,
} from "@/lib/calculations/currency";
import {
  financingCalculationTypes,
  type FinancingCalculation,
  type FinancingCalculationType,
} from "@/types/calculation";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalDisplayText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
  .pipe(z.string().uuid("Selecione um registro válido.").nullable());

const optionalCpf = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine(
    (value) => !value || onlyDigits(value).length === 11,
    "Informe um CPF com 11 digitos.",
  )
  .transform((value) => {
    const digits = onlyDigits(value);
    return digits || "";
  });

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone válido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseBrazilianDecimalInput(value))
  .refine((value) => value === null || !Number.isNaN(value), "Informe um valor válido.")
  .refine((value) => value === null || value >= 0, "Informe um valor maior ou igual a zero.");

const optionalPercentage = optionalNumber.refine(
  (value) => value === null || value <= 100,
  "Informe uma porcentagem entre 0 e 100.",
);

const optionalInteger = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const digits = String(value).replace(/\D/g, "");
    return digits ? Number(digits) : Number.NaN;
  })
  .refine((value) => value === null || Number.isInteger(value), "Informe um número válido.")
  .refine((value) => value === null || value >= 0, "Informe um número maior ou igual a zero.");

const optionalCalculationType = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
  .refine(
    (value): value is FinancingCalculationType | null =>
      value === null || financingCalculationTypes.some((item) => item.value === value),
    "Selecione um tipo de simulação válido.",
  );

export const financingCalculationFormSchema = z.object({
  client_id: optionalUuid,
  pre_sale_id: optionalUuid,
  simulation_type: optionalCalculationType,
  client_name: optionalDisplayText,
  client_cpf: optionalCpf,
  client_phone: optionalPhone,
  financial_institution: optionalText,
  specialist_name: optionalText,
  situation: optionalText,
  expires_in: optionalText,
  attendance_date: optionalText,
  vehicle: optionalText,
  vehicle_year: optionalText,
  administrative_fee: optionalNumber,
  insurance_value: optionalNumber,
  notes: optionalText,
  cash_value: optionalNumber,
  down_payment: optionalNumber,
  financed_value: optionalNumber,
  installment_count: optionalInteger,
  current_installment_value: optionalNumber,
  paid_installments: optionalInteger,
  remaining_installments: optionalInteger,
  installment_reduction_percentage: optionalPercentage,
  settlement_discount_percentage: optionalPercentage,
});

export type FinancingCalculationFormValues = z.input<
  typeof financingCalculationFormSchema
>;
export type FinancingCalculationPayload = z.output<
  typeof financingCalculationFormSchema
>;

export const financingCalculationDefaultValues: FinancingCalculationFormValues = {
  client_id: "",
  pre_sale_id: "",
  simulation_type: "veiculo",
  client_name: "",
  client_cpf: "",
  client_phone: "",
  financial_institution: "",
  specialist_name: "",
  situation: "",
  expires_in: "",
  attendance_date: "",
  vehicle: "",
  vehicle_year: "",
  administrative_fee: "",
  insurance_value: "",
  notes: "",
  cash_value: "",
  down_payment: "",
  financed_value: "",
  installment_count: "",
  current_installment_value: "",
  paid_installments: "",
  remaining_installments: "",
  installment_reduction_percentage: "30",
  settlement_discount_percentage: "",
};

function numberToInput(value: number | string | null | undefined) {
  return formatNumberForPtBrInput(value);
}

function integerToInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function dateToInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

export function financingCalculationToFormValues(
  calculation: FinancingCalculation,
): FinancingCalculationFormValues {
  return {
    client_id: calculation.client_id ?? "",
    pre_sale_id: calculation.pre_sale_id ?? "",
    simulation_type: calculation.simulation_type ?? "veiculo",
    client_name: calculation.client_name ?? "",
    client_cpf: formatCpf(calculation.client_cpf ?? ""),
    client_phone: formatPhone(calculation.client_phone ?? ""),
    financial_institution: calculation.financial_institution ?? "",
    specialist_name: calculation.specialist_name ?? "",
    situation: calculation.situation ?? "",
    expires_in: dateToInput(calculation.expires_in),
    attendance_date: dateToInput(calculation.attendance_date),
    vehicle: calculation.vehicle ?? "",
    vehicle_year: calculation.vehicle_year ?? "",
    administrative_fee: numberToInput(calculation.administrative_fee),
    insurance_value: numberToInput(calculation.insurance_value),
    notes: calculation.notes ?? "",
    cash_value: numberToInput(calculation.cash_value),
    down_payment: numberToInput(calculation.down_payment),
    financed_value: numberToInput(calculation.financed_value),
    installment_count: integerToInput(calculation.installment_count),
    current_installment_value: numberToInput(
      calculation.current_installment_value,
    ),
    paid_installments: integerToInput(calculation.paid_installments),
    remaining_installments: integerToInput(calculation.remaining_installments),
    installment_reduction_percentage: numberToInput(
      calculation.installment_reduction_percentage ?? 30,
    ),
    settlement_discount_percentage: numberToInput(
      calculation.settlement_discount_percentage,
    ),
  };
}
