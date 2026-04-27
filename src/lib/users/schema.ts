import { z } from "zod";
import { isValidPhone, onlyDigits } from "@/lib/clients/masks";
import type { CompanyUserProfile } from "@/types/user";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone valido.")
  .transform((value) => (value ? onlyDigits(value) : null));

export const createCompanyUserSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  email: z.string().trim().min(1, "Informe o email.").email("Informe um email valido."),
  phone: optionalPhone,
  role: z.enum(["admin", "manager", "seller"], {
    required_error: "Selecione o cargo.",
    invalid_type_error: "Selecione o cargo.",
  }),
  temporary_password: z
    .string()
    .trim()
    .min(6, "A senha provisoria deve ter pelo menos 6 caracteres."),
});

export const updateCompanyUserSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  phone: optionalPhone,
  role: z.enum(["admin", "manager", "seller"], {
    required_error: "Selecione o cargo.",
    invalid_type_error: "Selecione o cargo.",
  }),
  is_active: z.boolean(),
});

export type CreateCompanyUserFormValues = z.input<typeof createCompanyUserSchema>;
export type CreateCompanyUserPayload = z.output<typeof createCompanyUserSchema>;
export type UpdateCompanyUserFormValues = z.input<typeof updateCompanyUserSchema>;
export type UpdateCompanyUserPayload = z.output<typeof updateCompanyUserSchema>;

export const createCompanyUserDefaultValues: CreateCompanyUserFormValues = {
  full_name: "",
  email: "",
  phone: "",
  role: "seller",
  temporary_password: "",
};

export function companyUserToFormValues(
  user: CompanyUserProfile,
): UpdateCompanyUserFormValues {
  return {
    full_name: user.full_name ?? "",
    phone: user.phone ?? "",
    role: user.role ?? "seller",
    is_active: user.is_active,
  };
}
