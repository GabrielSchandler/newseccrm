import { z } from "zod";
import type { Client } from "@/types/client";
import { formatCpf, formatPhone, formatZipCode, isValidPhone, onlyDigits } from "./masks";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const clientFormSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  cpf: z
    .string()
    .trim()
    .min(1, "Informe o CPF.")
    .refine((value) => onlyDigits(value).length === 11, "Informe um CPF com 11 digitos.")
    .transform(onlyDigits),
  rg: z.string().trim().min(1, "Informe o RG.").transform((value) => value.trim()),
  nationality: optionalText,
  birth_date: z
    .string()
    .trim()
    .min(1, "Informe a data de nascimento.")
    .transform((value) => value.trim()),
  marital_status: z
    .string()
    .trim()
    .min(1, "Informe o estado civil.")
    .transform((value) => value.trim()),
  profession: optionalText,
  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(
      z
        .string()
        .min(1, "Informe o email.")
        .email("Informe um email valido."),
    ),
  phone_mobile: optionalText
    .refine((value) => isValidPhone(value), "Informe um telefone valido.")
    .transform((value) => (value ? onlyDigits(value) : null)),
  phone_secondary: optionalText.refine(
    (value) => isValidPhone(value),
    "Informe um telefone valido.",
  ).transform((value) => (value ? onlyDigits(value) : null)),
  zip_code: z.string().trim().min(1, "Informe o CEP.").transform((value) => value.trim()),
  street: z.string().trim().min(1, "Informe a rua.").transform((value) => value.trim()),
  number: z.string().trim().min(1, "Informe o numero.").transform((value) => value.trim()),
  district: z.string().trim().min(1, "Informe o bairro.").transform((value) => value.trim()),
  city: z.string().trim().min(1, "Informe a cidade.").transform((value) => value.trim()),
  state: z.string().trim().min(1, "Informe o estado.").transform((value) => value.trim()),
  notes: optionalText,
  commercial_consultant_user_id: z
    .union([z.string().uuid("Consultor comercial invalido."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
  legal_responsible_user_id: z
    .union([z.string().uuid("Responsavel juridico invalido."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
  legal_consultant_user_id: z
    .union([z.string().uuid("Consultor juridico invalido."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
});

export type ClientFormValues = z.input<typeof clientFormSchema>;
export type ClientPayload = z.output<typeof clientFormSchema>;

export const clientDefaultValues: ClientFormValues = {
  full_name: "",
  cpf: "",
  rg: "",
  nationality: "",
  birth_date: "",
  marital_status: "",
  profession: "",
  email: "",
  phone_mobile: "",
  phone_secondary: "",
  zip_code: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  notes: "",
  commercial_consultant_user_id: "",
  legal_responsible_user_id: "",
  legal_consultant_user_id: "",
};

export function clientToFormValues(client: Client): ClientFormValues {
  return {
    full_name: client.full_name,
    cpf: formatCpf(client.cpf),
    rg: client.rg ?? "",
    nationality: client.nationality ?? "",
    birth_date: client.birth_date ?? "",
    marital_status: client.marital_status ?? "",
    profession: client.profession ?? "",
    email: client.email ?? "",
    phone_mobile: formatPhone(client.phone_mobile),
    phone_secondary: formatPhone(client.phone_secondary),
    zip_code: formatZipCode(client.zip_code),
    street: client.street ?? "",
    number: client.number ?? "",
    district: client.district ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    notes: client.notes ?? "",
    commercial_consultant_user_id: client.commercial_consultant_user_id ?? "",
    legal_responsible_user_id: client.legal_responsible_user_id ?? "",
    legal_consultant_user_id: client.legal_consultant_user_id ?? "",
  };
}
