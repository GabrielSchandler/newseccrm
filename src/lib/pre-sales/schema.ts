import { z } from "zod";
import type { PreSale, PreSaleStatus } from "@/types/pre-sale";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const preSaleFormSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  consultant_user_id: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value ? value : null))
    .pipe(z.string().uuid("Selecione um consultor valido.").nullable()),
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
});

export type PreSaleFormValues = z.input<typeof preSaleFormSchema>;
export type PreSalePayload = z.output<typeof preSaleFormSchema>;

export const preSaleDefaultValues: PreSaleFormValues = {
  client_id: "",
  consultant_user_id: "",
  status: "lead",
  service_type: "",
  estimated_contract_value: "",
  negotiation_notes: "",
};

export function preSaleToFormValues(preSale: PreSale): PreSaleFormValues {
  return {
    client_id: preSale.client_id,
    consultant_user_id: preSale.consultant_user_id ?? "",
    status: preSale.status as PreSaleStatus,
    service_type: preSale.service_type ?? "",
    estimated_contract_value:
      preSale.estimated_contract_value === null
        ? ""
        : String(preSale.estimated_contract_value).replace(".", ","),
    negotiation_notes: preSale.negotiation_notes ?? "",
  };
}
