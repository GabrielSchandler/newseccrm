import { z } from "zod";
import { isValidPhone, onlyDigits } from "@/lib/clients/masks";
import { isUsernameLike, normalizeUsername } from "@/lib/users/account";
import type { CompanyUserProfile } from "@/types/user";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone valido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Informe um login com pelo menos 3 caracteres.")
  .transform((value) => normalizeUsername(value))
  .refine(
    (value) => value.length >= 3 && isUsernameLike(value),
    "Use apenas letras, numeros, ponto, hifen ou underscore no login.",
  );

export const createCompanyUserSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  username: usernameSchema,
  phone: optionalPhone,
  business_area: z.enum(["commercial", "legal"], {
    required_error: "Selecione a area principal.",
    invalid_type_error: "Selecione a area principal.",
  }),
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
  username: usernameSchema,
  phone: optionalPhone,
  business_area: z.enum(["commercial", "legal"], {
    required_error: "Selecione a area principal.",
    invalid_type_error: "Selecione a area principal.",
  }),
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
  username: "",
  phone: "",
  business_area: "commercial",
  role: "seller",
  temporary_password: "",
};

export function companyUserToFormValues(
  user: CompanyUserProfile,
): UpdateCompanyUserFormValues {
  return {
    full_name: user.full_name ?? "",
    username: user.username ?? "",
    phone: user.phone ?? "",
    business_area: user.business_area ?? "commercial",
    role: user.role ?? "seller",
    is_active: user.is_active,
  };
}
