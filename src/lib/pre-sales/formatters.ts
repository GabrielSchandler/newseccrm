import { preSaleTypes, type PreSaleType } from "@/types/pre-sale";
import { resolveUserDisplayName } from "@/lib/users/account";

export function formatCurrency(value: number | string | null) {
  if (value === null || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

export function formatUserName(
  user: { full_name: string | null; username?: string | null; email: string | null } | null,
) {
  return resolveUserDisplayName(user);
}

export function formatPreSaleType(type: PreSaleType | null | undefined) {
  return preSaleTypes.find((item) => item.value === type)?.label ?? "-";
}

export function formatBoolean(value: boolean | null | undefined) {
  if (value === true) {
    return "Sim";
  }

  if (value === false) {
    return "Não";
  }

  return "-";
}
