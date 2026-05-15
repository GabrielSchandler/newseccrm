import { z } from "zod";
import type {
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
  PreSalePayment,
  PreSaleStatus,
} from "@/types/pre-sale";
import { isValidPhone, onlyDigits } from "@/lib/clients/masks";
import {
  formatNumberForPtBrInput,
  parseBrazilianDecimalInput,
} from "@/lib/calculations/currency";

const leadMediaValues = ["Soul", "Growper", "Prosperity"] as const;

function sanitizeLeadMedia(
  value: string | null | undefined,
): "" | (typeof leadMediaValues)[number] {
  if (value === "Soul" || value === "Growper" || value === "Prosperity") {
    return value;
  }

  return "";
}

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const requiredText = z
  .string()
  .trim()
  .min(1, "Preencha este campo.")
  .transform((value) => value.trim());

const optionalLeadMedia = z
  .union([
    z.enum(leadMediaValues),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .transform((value) => (typeof value === "string" && value.trim() ? value : null));

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
  .pipe(z.string().email("Informe um email valido.").nullable());

const requiredCpf = z
  .string()
  .trim()
  .min(1, "Informe o CPF.")
  .refine((value) => onlyDigits(value).length === 11, "Informe um CPF com 11 digitos.")
  .transform(onlyDigits);

const optionalCpf = optionalText
  .refine(
    (value) => !value || onlyDigits(value).length === 11,
    "Informe um CPF com 11 digitos.",
  )
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalCnpj = optionalText
  .refine(
    (value) => !value || onlyDigits(value).length === 14,
    "Informe um CNPJ com 14 digitos.",
  )
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone valido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseBrazilianDecimalInput(value))
  .refine((value) => value === null || !Number.isNaN(value), "Informe um valor valido.");

const requiredNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseBrazilianDecimalInput(value))
  .refine((value) => value !== null && !Number.isNaN(value), "Informe um valor valido.")
  .transform((value) => value as number);

const optionalInteger = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const digits = String(value).replace(/\D/g, "");
    return digits ? Number(digits) : Number.NaN;
  })
  .refine((value) => value === null || Number.isInteger(value), "Informe um numero valido.");

export const preSaleFormSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  consultant_user_id: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value ? value : null))
    .pipe(z.string().uuid("Selecione um consultor valido.").nullable()),
  pre_sale_type: z.enum(["emprestimo", "imovel", "veiculo"], {
    required_error: "Selecione o tipo de pre-venda.",
    invalid_type_error: "Selecione o tipo de pre-venda.",
  }),
  status: z.enum([
    "lead",
    "pre_venda",
    "em_contato",
    "em_negociacao",
    "aprovado",
    "perdido",
    "inativo",
    "distrato",
  ]),
  media: optionalLeadMedia,
  service_type: optionalText,
  contract_value: requiredNumber,
  payment_description: requiredText,
  negotiation_details: optionalText,
  legal_department: optionalText,
  legal_status_text: optionalText,
  legal_document_status: optionalText,
  legal_case_number: optionalText,
  legal_case_year: optionalText,
  legal_deadline: optionalText,
  legal_county: optionalText,
  legal_forum: optionalText,
  legal_court_division: optionalText,
  legal_operator_name: optionalText,
  legal_process_operator_name: optionalText,
  legal_protocol: optionalText,
  snapshot_full_name: z.string().trim().min(1, "Informe o nome do contratante."),
  snapshot_cpf: requiredCpf,
  snapshot_rg: optionalText,
  snapshot_birth_date: optionalText,
  snapshot_marital_status: optionalText,
  snapshot_profession: optionalText,
  snapshot_email: optionalEmail,
  snapshot_phone_mobile: optionalPhone,
  snapshot_phone_secondary: optionalPhone,
  snapshot_zip_code: optionalText,
  snapshot_street: optionalText,
  snapshot_number: optionalText,
  snapshot_district: optionalText,
  snapshot_city: optionalText,
  snapshot_state: optionalText,
  debt_holder_full_name: optionalText,
  debt_holder_cpf: optionalCpf,
  debt_holder_rg: optionalText,
  debt_holder_birth_date: optionalText,
  debt_holder_marital_status: optionalText,
  debt_holder_profession: optionalText,
  debt_holder_nationality: optionalText,
  debt_holder_issuer_agency: optionalText,
  debt_holder_father_name: optionalText,
  debt_holder_mother_name: optionalText,
  debt_holder_phone_mobile: optionalPhone,
  debt_holder_phone_secondary: optionalPhone,
  debt_holder_email: optionalEmail,
  debt_holder_zip_code: optionalText,
  debt_holder_street: optionalText,
  debt_holder_number: optionalText,
  debt_holder_district: optionalText,
  debt_holder_city: optionalText,
  debt_holder_state: optionalText,
  financer_name: requiredText,
  financer_legal_name: optionalText,
  financer_cnpj: optionalCnpj,
  financer_address: optionalText,
  financer_district: optionalText,
  financer_zip_code: optionalText,
  financer_city: optionalText,
  financer_state: optionalText,
  has_financing_contract: z
    .union([z.boolean(), z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === true || value === "true") {
        return true;
      }

      if (value === false || value === "false") {
        return false;
      }

      return null;
  }),
  financed_amount: optionalNumber,
  installment_amount: optionalNumber,
  paid_installments: optionalInteger,
  overdue_installments: optionalInteger,
  due_day: optionalInteger.refine(
    (value) => value === null || (value >= 1 && value <= 31),
    "Informe um dia entre 1 e 31.",
  ),
  contract_number: optionalText,
  asset_brand_model: optionalText,
  asset_color: optionalText,
  asset_year: optionalText,
  asset_plate: optionalText,
  payments: z
    .array(
      z.object({
        installment_number: optionalInteger,
        amount: optionalNumber,
        payment_method: optionalText,
        payment_date: optionalText,
        status: optionalText,
      }),
    )
    .max(12, "Informe no maximo 12 pagamentos previstos."),
}).superRefine((values, context) => {
  if (values.debt_holder_full_name || values.debt_holder_cpf) {
    if (!values.debt_holder_issuer_agency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debt_holder_issuer_agency"],
        message: "Informe o orgao emissor quando houver titular da divida.",
      });
    }
  }

  if (values.pre_sale_type !== "veiculo") {
    return;
  }

  const requiredVehicleFields = [
    ["asset_brand_model", values.asset_brand_model, "Informe o veiculo."],
    ["asset_color", values.asset_color, "Informe a cor."],
    ["asset_year", values.asset_year, "Informe o ano."],
    ["asset_plate", values.asset_plate, "Informe a placa."],
  ] as const;

  requiredVehicleFields.forEach(([path, value, message]) => {
    if (!value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message,
      });
    }
  });
});

export type PreSaleFormValues = z.input<typeof preSaleFormSchema>;
export type PreSalePayload = z.output<typeof preSaleFormSchema>;

export const preSaleDefaultValues: PreSaleFormValues = {
  client_id: "",
  consultant_user_id: "",
  pre_sale_type: "emprestimo",
  status: "lead",
  media: "",
  service_type: "",
  contract_value: "",
  payment_description: "",
  negotiation_details: "",
  legal_department: "",
  legal_status_text: "",
  legal_document_status: "",
  legal_case_number: "",
  legal_case_year: "",
  legal_deadline: "",
  legal_county: "",
  legal_forum: "",
  legal_court_division: "",
  legal_operator_name: "",
  legal_process_operator_name: "",
  legal_protocol: "",
  snapshot_full_name: "",
  snapshot_cpf: "",
  snapshot_rg: "",
  snapshot_birth_date: "",
  snapshot_marital_status: "",
  snapshot_profession: "",
  snapshot_email: "",
  snapshot_phone_mobile: "",
  snapshot_phone_secondary: "",
  snapshot_zip_code: "",
  snapshot_street: "",
  snapshot_number: "",
  snapshot_district: "",
  snapshot_city: "",
  snapshot_state: "",
  debt_holder_full_name: "",
  debt_holder_cpf: "",
  debt_holder_rg: "",
  debt_holder_birth_date: "",
  debt_holder_marital_status: "",
  debt_holder_profession: "",
  debt_holder_nationality: "",
  debt_holder_issuer_agency: "",
  debt_holder_father_name: "",
  debt_holder_mother_name: "",
  debt_holder_phone_mobile: "",
  debt_holder_phone_secondary: "",
  debt_holder_email: "",
  debt_holder_zip_code: "",
  debt_holder_street: "",
  debt_holder_number: "",
  debt_holder_district: "",
  debt_holder_city: "",
  debt_holder_state: "",
  financer_name: "",
  financer_legal_name: "",
  financer_cnpj: "",
  financer_address: "",
  financer_district: "",
  financer_zip_code: "",
  financer_city: "",
  financer_state: "",
  has_financing_contract: "",
  financed_amount: "",
  installment_amount: "",
  paid_installments: "",
  overdue_installments: "",
  due_day: "",
  contract_number: "",
  asset_brand_model: "",
  asset_color: "",
  asset_year: "",
  asset_plate: "",
  payments: [
    { installment_number: "1", amount: "", payment_method: "", payment_date: "", status: "previsto" },
    { installment_number: "2", amount: "", payment_method: "", payment_date: "", status: "previsto" },
    { installment_number: "3", amount: "", payment_method: "", payment_date: "", status: "previsto" },
  ],
};

export function preSaleToFormValues(
  preSale: PreSale,
  snapshot?: PreSaleClientSnapshot | null,
  debtHolder?: PreSaleDebtHolder | null,
  financialCase?: PreSaleFinancialCase | null,
  payments: PreSalePayment[] = [],
): PreSaleFormValues {
  return {
    client_id: preSale.client_id,
    consultant_user_id: preSale.consultant_user_id ?? "",
    pre_sale_type: preSale.pre_sale_type ?? "emprestimo",
    status: preSale.status as PreSaleStatus,
    media: sanitizeLeadMedia(preSale.media),
    service_type: preSale.service_type ?? "",
    contract_value:
      formatNumberForPtBrInput(preSale.contract_value),
    payment_description: preSale.payment_description ?? "",
    negotiation_details: preSale.negotiation_details ?? "",
    legal_department: preSale.legal_department ?? "",
    legal_status_text: preSale.legal_status_text ?? "",
    legal_document_status: preSale.legal_document_status ?? "",
    legal_case_number: preSale.legal_case_number ?? "",
    legal_case_year: preSale.legal_case_year ?? "",
    legal_deadline: preSale.legal_deadline ?? "",
    legal_county: preSale.legal_county ?? "",
    legal_forum: preSale.legal_forum ?? "",
    legal_court_division: preSale.legal_court_division ?? "",
    legal_operator_name: preSale.legal_operator_name ?? "",
    legal_process_operator_name: preSale.legal_process_operator_name ?? "",
    legal_protocol: preSale.legal_protocol ?? "",
    snapshot_full_name: snapshot?.full_name ?? "",
    snapshot_cpf: snapshot?.cpf ?? "",
    snapshot_rg: snapshot?.rg ?? "",
    snapshot_birth_date: snapshot?.birth_date ?? "",
    snapshot_marital_status: snapshot?.marital_status ?? "",
    snapshot_profession: snapshot?.profession ?? "",
    snapshot_email: snapshot?.email ?? "",
    snapshot_phone_mobile: snapshot?.phone_mobile ?? "",
    snapshot_phone_secondary: snapshot?.phone_secondary ?? "",
    snapshot_zip_code: snapshot?.zip_code ?? "",
    snapshot_street: snapshot?.street ?? "",
    snapshot_number: snapshot?.number ?? "",
    snapshot_district: snapshot?.district ?? "",
    snapshot_city: snapshot?.city ?? "",
    snapshot_state: snapshot?.state ?? "",
    debt_holder_full_name: debtHolder?.full_name ?? "",
    debt_holder_cpf: debtHolder?.cpf ?? "",
    debt_holder_rg: debtHolder?.rg ?? "",
    debt_holder_birth_date: debtHolder?.birth_date ?? "",
    debt_holder_marital_status: debtHolder?.marital_status ?? "",
    debt_holder_profession: debtHolder?.profession ?? "",
    debt_holder_nationality: debtHolder?.nationality ?? "",
    debt_holder_issuer_agency: debtHolder?.issuer_agency ?? "",
    debt_holder_father_name: debtHolder?.father_name ?? "",
    debt_holder_mother_name: debtHolder?.mother_name ?? "",
    debt_holder_phone_mobile: debtHolder?.phone_mobile ?? "",
    debt_holder_phone_secondary: debtHolder?.phone_secondary ?? "",
    debt_holder_email: debtHolder?.email ?? "",
    debt_holder_zip_code: debtHolder?.zip_code ?? "",
    debt_holder_street: debtHolder?.street ?? "",
    debt_holder_number: debtHolder?.number ?? "",
    debt_holder_district: debtHolder?.district ?? "",
    debt_holder_city: debtHolder?.city ?? "",
    debt_holder_state: debtHolder?.state ?? "",
    financer_name: financialCase?.financer_name ?? "",
    financer_legal_name: financialCase?.financer_legal_name ?? "",
    financer_cnpj: financialCase?.financer_cnpj ?? "",
    financer_address: financialCase?.financer_address ?? "",
    financer_district: financialCase?.financer_district ?? "",
    financer_zip_code: financialCase?.financer_zip_code ?? "",
    financer_city: financialCase?.financer_city ?? "",
    financer_state: financialCase?.financer_state ?? "",
    has_financing_contract:
      financialCase?.has_financing_contract === null ||
      financialCase?.has_financing_contract === undefined
        ? ""
        : String(financialCase.has_financing_contract),
    financed_amount:
      formatNumberForPtBrInput(financialCase?.financed_amount),
    installment_amount:
      formatNumberForPtBrInput(financialCase?.installment_amount),
    paid_installments:
      financialCase?.paid_installments === null ||
      financialCase?.paid_installments === undefined
        ? ""
        : String(financialCase.paid_installments),
    overdue_installments:
      financialCase?.overdue_installments === null ||
      financialCase?.overdue_installments === undefined
        ? ""
        : String(financialCase.overdue_installments),
    due_day:
      financialCase?.due_day === null || financialCase?.due_day === undefined
        ? ""
        : String(financialCase.due_day),
    contract_number: financialCase?.contract_number ?? "",
    asset_brand_model: financialCase?.asset_brand_model ?? "",
    asset_color: financialCase?.asset_color ?? "",
    asset_year: financialCase?.asset_year ? String(financialCase.asset_year) : "",
    asset_plate: financialCase?.asset_plate ?? "",
    payments: payments.length
      ? payments.map((payment) => ({
          installment_number:
            payment.installment_number === null ||
            payment.installment_number === undefined
              ? ""
              : String(payment.installment_number),
          amount:
            formatNumberForPtBrInput(payment.amount),
          payment_method: payment.payment_method ?? "",
          payment_date: payment.payment_date ?? "",
          status: payment.status ?? "previsto",
        }))
      : preSaleDefaultValues.payments,
  };
}
