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

export function formatUserName(user: { full_name: string | null; email: string | null } | null) {
  return user?.full_name || user?.email || "-";
}
