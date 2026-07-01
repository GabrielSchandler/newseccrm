import { z } from "zod";
import { onlyDigits } from "@/lib/clients/masks";
import type { CompanyProfile } from "@/types/company";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalPhone = optionalText.transform((value) =>
  value ? onlyDigits(value) : null,
);

const optionalZipCode = optionalText.transform((value) =>
  value ? onlyDigits(value) : null,
);

const optionalWebsite = optionalText.refine(
  (value) =>
    !value ||
    /^https?:\/\/.+/i.test(value) ||
    /^[\w.-]+\.[a-z]{2,}/i.test(value),
  "Informe um site valido.",
);

export const companyProfileSchema = z.object({
  legal_name: optionalText,
  trade_name: optionalText,
  cnpj: optionalText.transform((value) => (value ? onlyDigits(value) : null)),
  email: optionalText.refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Informe um e-mail valido.",
  ),
  phone: optionalPhone,
  website: optionalWebsite,
  zip_code: optionalZipCode,
  street: optionalText,
  number: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText.transform((value) => (value ? value.toUpperCase() : null)),
  simulation_guarantee_title: optionalText,
  simulation_guarantee_lead: optionalText,
  simulation_guarantee_clause_label: optionalText,
  simulation_guarantee_clause_text: optionalText,
});

export type CompanyProfilePayload = z.output<typeof companyProfileSchema>;
export type CompanyProfileFormValues = z.input<typeof companyProfileSchema>;

export const companyProfileDefaultValues: CompanyProfileFormValues = {
  legal_name: "",
  trade_name: "",
  cnpj: "",
  email: "",
  phone: "",
  website: "",
  zip_code: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  simulation_guarantee_title: "",
  simulation_guarantee_lead: "",
  simulation_guarantee_clause_label: "",
  simulation_guarantee_clause_text: "",
};

export function companyProfileToFormValues(
  company: CompanyProfile,
): CompanyProfileFormValues {
  return {
    legal_name: company.legal_name ?? "",
    trade_name: company.trade_name ?? "",
    cnpj: company.cnpj ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    zip_code: company.zip_code ?? "",
    street: company.street ?? "",
    number: company.number ?? "",
    district: company.district ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    simulation_guarantee_title: company.simulation_guarantee_title ?? "",
    simulation_guarantee_lead: company.simulation_guarantee_lead ?? "",
    simulation_guarantee_clause_label: company.simulation_guarantee_clause_label ?? "",
    simulation_guarantee_clause_text: company.simulation_guarantee_clause_text ?? "",
  };
}
