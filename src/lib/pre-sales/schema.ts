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

const leadMediaValues = ["Soul", "Growper", "Prosperity"] as const;

function parseBrazilianDecimalInput(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatNumberForPtBrInput(value: number | string | null | undefined) {
  const parsed = parseBrazilianDecimalInput(value);

  if (parsed === null || Number.isNaN(parsed)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

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

const requiredPhone = z
  .string()
  .trim()
  .min(1, "Informe o celular.")
  .refine((value) => isValidPhone(value, true), "Informe um telefone valido.")
  .transform(onlyDigits);

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone valido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseBrazilianDecimalInput(value))
  .refine((value) => value === null || !Number.isNaN(value), "Informe um valor valido.");

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
  ]),
  media: optionalLeadMedia,
  service_type: optionalText,
  contract_value: optionalNumber,
  payment_description: optionalText,
  negotiation_details: optionalText,
  snapshot_full_name: z.string().trim().min(1, "Informe o nome do contratante."),
  snapshot_cpf: requiredCpf,
  snapshot_rg: optionalText,
  snapshot_birth_date: optionalText,
  snapshot_marital_status: optionalText,
  snapshot_profession: optionalText,
  snapshot_email: optionalEmail,
  snapshot_phone_mobile: requiredPhone,
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
  financer_name: optionalText,
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
