import { z } from "zod";
import type { PreSale, PreSaleFinancialCase, PreSaleStatus } from "@/types/pre-sale";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

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
  service_type: optionalText,
  estimated_contract_value: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const normalized = String(value).replace(/\./g, "").replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === null || !Number.isNaN(value), "Informe um valor valido."),
  negotiation_notes: optionalText,
  asset_brand_model: optionalText,
  asset_color: optionalText,
  asset_year: optionalText,
  asset_plate: optionalText,
});

export type PreSaleFormValues = z.input<typeof preSaleFormSchema>;
export type PreSalePayload = z.output<typeof preSaleFormSchema>;

export const preSaleDefaultValues: PreSaleFormValues = {
  client_id: "",
  consultant_user_id: "",
  pre_sale_type: "emprestimo",
  status: "lead",
  service_type: "",
  estimated_contract_value: "",
  negotiation_notes: "",
  asset_brand_model: "",
  asset_color: "",
  asset_year: "",
  asset_plate: "",
};

export function preSaleToFormValues(
  preSale: PreSale,
  financialCase?: PreSaleFinancialCase | null,
): PreSaleFormValues {
  return {
    client_id: preSale.client_id,
    consultant_user_id: preSale.consultant_user_id ?? "",
    pre_sale_type: preSale.pre_sale_type ?? "emprestimo",
    status: preSale.status as PreSaleStatus,
    service_type: preSale.service_type ?? "",
    estimated_contract_value:
      preSale.estimated_contract_value === null
        ? ""
        : String(preSale.estimated_contract_value).replace(".", ","),
    negotiation_notes: preSale.negotiation_notes ?? "",
    asset_brand_model: financialCase?.asset_brand_model ?? "",
    asset_color: financialCase?.asset_color ?? "",
    asset_year: financialCase?.asset_year ? String(financialCase.asset_year) : "",
    asset_plate: financialCase?.asset_plate ?? "",
  };
}
