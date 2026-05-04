const ptBrNumberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseBrazilianDecimalInput(
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed.replace(/[^\d,.-]/g, "");
  const isNegative = sanitized.startsWith("-");
  const unsigned = sanitized.replace(/-/g, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  if (decimalSeparatorIndex >= 0) {
    const integerPart = unsigned
      .slice(0, decimalSeparatorIndex)
      .replace(/\D/g, "");
    const decimalDigits = unsigned
      .slice(decimalSeparatorIndex + 1)
      .replace(/\D/g, "");

    if (decimalDigits.length >= 1 && decimalDigits.length <= 2) {
      const parsed = Number(
        `${isNegative ? "-" : ""}${integerPart || "0"}.${decimalDigits
          .slice(0, 2)
          .padEnd(2, "0")}`,
      );

      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
  }

  const digits = unsigned.replace(/\D/g, "");

  if (!digits) {
    return Number.NaN;
  }

  const parsed = Number(`${isNegative ? "-" : ""}${digits}`);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatNumberForPtBrInput(
  value: number | string | null | undefined,
) {
  const parsed = parseBrazilianDecimalInput(value);

  if (parsed === null || Number.isNaN(parsed)) {
    return "";
  }

  return ptBrNumberFormatter.format(parsed);
}

export function formatCurrencyInputValueFromDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const numeric = Number(digits) / 100;

  return ptBrNumberFormatter.format(numeric);
}

export function normalizeCurrencyInputValue(value: string | number | null | undefined) {
  return formatNumberForPtBrInput(value);
}
