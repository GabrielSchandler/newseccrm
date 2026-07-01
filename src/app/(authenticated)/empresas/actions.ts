"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { onlyDigits } from "@/lib/clients/masks";
import { getHomeForRole } from "@/lib/workspace";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

const createCompanySchema = z.object({
  trade_name: z.string().trim().min(2, "Informe o nome fantasia."),
  legal_name: optionalText,
  cnpj: optionalText.transform((value) => (value ? onlyDigits(value) : null)),
  email: optionalText.refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Informe um e-mail valido.",
  ),
  phone: optionalText.transform((value) => (value ? onlyDigits(value) : null)),
});

function redirectWithError(error: string): never {
  redirect(`/empresas?error=${encodeURIComponent(error)}`);
}

export async function createPlatformCompanyAction(formData: FormData) {
  const { supabase, role, businessArea, isPlatformOwner } =
    await getCurrentUserContext();

  if (!isPlatformOwner) {
    redirect(getHomeForRole(role, businessArea));
  }

  const parsed = createCompanySchema.safeParse({
    trade_name: formData.get("trade_name"),
    legal_name: formData.get("legal_name"),
    cnpj: formData.get("cnpj"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    redirectWithError("Confira os dados da nova empresa.");
  }

  const tradeName = parsed.data.trade_name;
  const legalName = parsed.data.legal_name || tradeName;
  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...parsed.data,
      legal_name: legalName,
      trade_name: tradeName,
      user_license_limit: 10,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    redirectWithError(error?.message || "Nao foi possivel criar a empresa.");
  }

  redirect(`/empresas/select?company=${data.id}`);
}
