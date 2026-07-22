import { z } from "zod";
import {
  formatNumberForPtBrInput,
  parseBrazilianDecimalInput,
} from "@/lib/calculations/currency";
import { isValidPhone, onlyDigits } from "@/lib/clients/masks";
import { isUsernameLike, normalizeUsername } from "@/lib/users/account";
import type { CompanyUserProfile } from "@/types/user";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const optionalPhone = optionalText
  .refine((value) => isValidPhone(value), "Informe um telefone válido.")
  .transform((value) => (value ? onlyDigits(value) : null));

const optionalCurrency = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseBrazilianDecimalInput(value))
  .refine(
    (value) => value === null || (!Number.isNaN(value) && value >= 0),
    "Informe um valor válido.",
  );

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Informe um login com pelo menos 3 caracteres.")
  .transform((value) => normalizeUsername(value))
  .refine(
    (value) => value.length >= 3 && isUsernameLike(value),
    "Use apenas letras, números, ponto, hifen ou underscore no login.",
  );

function normalizeMonthlyGoal<T extends { business_area: string; role: string; monthly_goal: number | null }>(
  values: T,
) {
  return {
    ...values,
    monthly_goal:
      values.business_area === "commercial" && values.role === "seller"
        ? values.monthly_goal
        : null,
    can_edit_legal_workflow:
      values.business_area === "legal" &&
      "can_edit_legal_workflow" in values
        ? Boolean(values.can_edit_legal_workflow)
        : false,
  };
}

const createCompanyUserBaseSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  nickname: optionalText,
  username: usernameSchema,
  phone: optionalPhone,
  monthly_goal: optionalCurrency,
  business_area: z.enum(["commercial", "legal"], {
    required_error: "Selecione a área principal.",
    invalid_type_error: "Selecione a área principal.",
  }),
  role: z.enum(["admin", "manager", "seller"], {
    required_error: "Selecione o cargo.",
    invalid_type_error: "Selecione o cargo.",
  }),
  legal_role: z.enum(["admin", "consultant"]).default("consultant"),
  can_edit_legal_workflow: z.boolean().default(false),
  temporary_password: z
    .string()
    .trim()
    .min(6, "A senha provisória deve ter pelo menos 6 caracteres."),
});

export const createCompanyUserSchema = createCompanyUserBaseSchema.transform(
  normalizeMonthlyGoal,
);

const updateCompanyUserBaseSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  nickname: optionalText,
  username: usernameSchema,
  phone: optionalPhone,
  monthly_goal: optionalCurrency,
  business_area: z.enum(["commercial", "legal"], {
    required_error: "Selecione a área principal.",
    invalid_type_error: "Selecione a área principal.",
  }),
  role: z.enum(["admin", "manager", "seller"], {
    required_error: "Selecione o cargo.",
    invalid_type_error: "Selecione o cargo.",
  }),
  legal_role: z.enum(["admin", "consultant"]).default("consultant"),
  can_edit_legal_workflow: z.boolean().default(false),
  is_active: z.boolean(),
  new_password: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
    .refine(
      (value) => value === null || value.length >= 6,
      "A nova senha deve ter pelo menos 6 caracteres.",
    ),
  force_password_change: z.boolean().default(true),
});

export const updateCompanyUserSchema = updateCompanyUserBaseSchema.transform(
  normalizeMonthlyGoal,
);

export type CreateCompanyUserFormValues = z.input<typeof createCompanyUserSchema>;
export type CreateCompanyUserPayload = z.output<typeof createCompanyUserSchema>;
export type UpdateCompanyUserFormValues = z.input<typeof updateCompanyUserSchema>;
export type UpdateCompanyUserPayload = z.output<typeof updateCompanyUserSchema>;

export const createCompanyUserDefaultValues: CreateCompanyUserFormValues = {
  full_name: "",
  nickname: "",
  username: "",
  phone: "",
  monthly_goal: "",
  business_area: "commercial",
  role: "seller",
  legal_role: "consultant",
  can_edit_legal_workflow: false,
  temporary_password: "",
};

export function companyUserToFormValues(
  user: CompanyUserProfile,
): UpdateCompanyUserFormValues {
  return {
    full_name: user.full_name ?? "",
    nickname: user.nickname ?? "",
    username: user.username ?? "",
    phone: user.phone ?? "",
    monthly_goal: formatNumberForPtBrInput(user.monthly_goal),
    business_area: user.business_area ?? "commercial",
    role: user.role ?? "seller",
    legal_role: user.legal_role ?? "consultant",
    can_edit_legal_workflow: Boolean(user.can_edit_legal_workflow),
    is_active: user.is_active,
    new_password: "",
    force_password_change: true,
  };
}
