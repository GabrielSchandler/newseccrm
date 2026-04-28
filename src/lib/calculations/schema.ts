import { z } from "zod";
import { isValidPhone, onlyDigits } from "@/lib/clients/masks";
import type { FinancingCalculation } from "@/types/calculation";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
  .pipe(z.string().uuid("Selecione um registro valido.").nullable());

const requiredCpf = z
  .string()
  .trim()
  .min(1, "Informe o CPF.")
  .refine((value) => onlyDigits(value).length === 11, "Informe um CPF com 11 digitos.")
  .transform(onlyDigits);

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone valido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const normalized = String(value).replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || !Number.isNaN(value), "Informe um valor valido.")
  .refine((value) => value === null || value >= 0, "Informe um valor maior ou igual a zero.");

const optionalInteger = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const digits = String(value).replace(/\D/g, "");
    return digits ? Number(digits) : Number.NaN;
  })
  .refine((value) => value === null || Number.isInteger(value), "Informe um numero valido.")
  .refine((value) => value === null || value >= 0, "Informe um numero maior ou igual a zero.");

export const financingCalculationFormSchema = z.object({
  client_id: optionalUuid,
  pre_sale_id: optionalUuid,
  client_name: z.string().trim().min(1, "Informe o nome do cliente."),
  client_cpf: requiredCpf,
  client_phone: optionalPhone,
  financial_institution: optionalText,
  specialist_name: optionalText,
  situation: optionalText,
  expires_in: optionalText,
  attendance_date: optionalText,
  vehicle_year: optionalText,
  notes: optionalText,
  cash_value: optionalNumber,
  down_payment: optionalNumber,
  financed_value: optionalNumber,
  installment_count: optionalInteger,
  current_installment_value: optionalNumber,
  paid_installments: optionalInteger,
  remaining_installments: optionalInteger,
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
  client_name: "",
  client_cpf: "",
  client_phone: "",
  financial_institution: "",
  specialist_name: "",
  situation: "",
  expires_in: "",
  attendance_date: "",
  vehicle_year: "",
  notes: "",
  cash_value: "",
  down_payment: "",
  financed_value: "",
  installment_count: "",
  current_installment_value: "",
  paid_installments: "",
  remaining_installments: "",
};

function numberToInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value).replace(".", ",");
}

function integerToInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

export function financingCalculationToFormValues(
  calculation: FinancingCalculation,
): FinancingCalculationFormValues {
  return {
    client_id: calculation.client_id ?? "",
    pre_sale_id: calculation.pre_sale_id ?? "",
    client_name: calculation.client_name,
    client_cpf: calculation.client_cpf,
    client_phone: calculation.client_phone ?? "",
    financial_institution: calculation.financial_institution ?? "",
    specialist_name: calculation.specialist_name ?? "",
    situation: calculation.situation ?? "",
    expires_in: calculation.expires_in ?? "",
    attendance_date: calculation.attendance_date ?? "",
    vehicle_year: calculation.vehicle_year ?? "",
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
  };
}
