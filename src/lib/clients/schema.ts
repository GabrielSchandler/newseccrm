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
  rg: optionalText,
  birth_date: optionalText,
  marital_status: optionalText,
  profession: optionalText,
  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
    .pipe(z.string().email("Informe um email valido.").nullable()),
  phone_mobile: z
    .string()
    .trim()
    .min(1, "Informe o celular.")
    .refine((value) => isValidPhone(value, true), "Informe um telefone valido.")
    .transform(onlyDigits),
  phone_secondary: optionalText.refine(
    (value) => isValidPhone(value),
    "Informe um telefone valido.",
  ).transform((value) => (value ? onlyDigits(value) : null)),
  zip_code: optionalText,
  street: optionalText,
  number: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText,
  notes: optionalText,
});

export type ClientFormValues = z.input<typeof clientFormSchema>;
export type ClientPayload = z.output<typeof clientFormSchema>;

export const clientDefaultValues: ClientFormValues = {
  full_name: "",
  cpf: "",
  rg: "",
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
};

export function clientToFormValues(client: Client): ClientFormValues {
  return {
    full_name: client.full_name,
    cpf: formatCpf(client.cpf),
    rg: client.rg ?? "",
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
  };
}
