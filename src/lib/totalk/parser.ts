import { formatNumberForPtBrInput, parseBrazilianDecimalInput } from "@/lib/calculations/currency";
import { formatPhone, onlyDigits } from "@/lib/clients/masks";
import type { FinancingCalculationFormValues } from "@/lib/calculations/schema";
import type { FinancingCalculationType } from "@/types/calculation";

export type ParsedTotalkCalculationData = {
  fields: Partial<FinancingCalculationFormValues>;
  summary: Array<{ label: string; value: string }>;
  missingFields: string[];
  warnings: string[];
};

type LineRecord = {
  rawLabel: string;
  normalizedLabel: string;
  value: string;
};

const requiredFieldLabels = {
  simulation_type: "Tipo da simulação",
  financial_institution: "Banco/financeira",
  financed_value: "Valor financiado ou valor do bem com entrada",
  current_installment_value: "Valor atual da parcela",
  installment_count: "Total de parcelas",
  paid_installments: "Parcelas pagas",
} satisfies Record<string, string>;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseLines(annotation: string) {
  return annotation
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.search(/[:：]/);

      if (separatorIndex < 0) {
        return null;
      }

      const rawLabel = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/\.$/, "").trim();

      if (!rawLabel || !value) {
        return null;
      }

      return {
        rawLabel,
        normalizedLabel: normalizeText(rawLabel),
        value,
      } satisfies LineRecord;
    })
    .filter((line): line is LineRecord => Boolean(line));
}

function findValue(lines: LineRecord[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeText);
  const directMatch = lines.find((line) =>
    normalizedAliases.includes(line.normalizedLabel),
  );

  if (directMatch) {
    return directMatch.value;
  }

  return lines.find((line) =>
    normalizedAliases.some((alias) => line.normalizedLabel.includes(alias)),
  )?.value ?? null;
}

function parseCurrencyInput(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = parseBrazilianDecimalInput(value);

  if (parsed === null || !Number.isFinite(parsed)) {
    return "";
  }

  return formatNumberForPtBrInput(parsed);
}

function parseIntegerInput(value: string | null) {
  if (!value) {
    return "";
  }

  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  return String(Number(digits));
}

function inferSimulationType(annotation: string): FinancingCalculationType | null {
  const normalized = normalizeText(annotation);

  if (normalized.includes("veiculo") || normalized.includes("carro")) {
    return "veiculo";
  }

  if (
    normalized.includes("imovel") ||
    normalized.includes("imobiliario") ||
    normalized.includes("habitacional")
  ) {
    return "imovel";
  }

  if (
    normalized.includes("emprestimo") ||
    normalized.includes("consignado") ||
    normalized.includes("credito pessoal")
  ) {
    return "emprestimo";
  }

  return null;
}

function splitVehicleAndYear(value: string | null) {
  if (!value) {
    return { vehicle: "", year: "" };
  }

  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0] ?? "";
  const vehicle = value
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[,/|-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { vehicle, year };
}

function addSummary(
  summary: Array<{ label: string; value: string }>,
  label: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return;
  }

  summary.push({ label, value: normalizedValue });
}

export function parseTotalkCalculationAnnotation(
  annotation: string,
  fallbackPhone?: string | null,
): ParsedTotalkCalculationData {
  const lines = parseLines(annotation);
  const warnings: string[] = [];
  const fields: Partial<FinancingCalculationFormValues> = {};
  const summary: Array<{ label: string; value: string }> = [];
  const simulationType = inferSimulationType(annotation);

  if (simulationType) {
    fields.simulation_type = simulationType;
    addSummary(summary, "Tipo", simulationType);
  }

  const clientName = findValue(lines, [
    "Nome do titular",
    "Titular",
    "Nome do cliente",
    "Cliente",
    "Nome",
  ]);
  const bank = findValue(lines, ["Banco", "Financeira", "Instituição financeira"]);
  const vehicleRaw = findValue(lines, ["Veículo", "Veiculo", "Carro", "Modelo"]);
  const yearRaw = findValue(lines, ["Ano", "Ano do veículo", "Ano do veiculo"]);
  const cashValue = parseCurrencyInput(
    findValue(lines, [
      "Valor do veículo",
      "Valor do veiculo",
      "Valor do bem",
      "Valor à vista",
      "Valor a vista",
      "Valor do imóvel",
      "Valor do imovel",
    ]),
  );
  const downPayment = parseCurrencyInput(
    findValue(lines, ["Valor de entrada", "Entrada", "Valor da entrada"]),
  );
  const financedValue = parseCurrencyInput(
    findValue(lines, ["Valor financiado", "Financiamento", "Valor do financiamento"]),
  );
  const currentInstallment = parseCurrencyInput(
    findValue(lines, ["Valor da parcela", "Parcela", "Valor atual da parcela"]),
  );
  const installmentCount = parseIntegerInput(
    findValue(lines, ["Total de parcelas", "Quantidade de parcelas", "Parcelas totais"]),
  );
  const paidInstallments = parseIntegerInput(
    findValue(lines, ["Parcelas já pagas", "Parcelas ja pagas", "Parcelas pagas"]),
  );
  const dueDay = parseIntegerInput(
    findValue(lines, ["Dia de vencimento", "Vencimento", "Dia vencimento"]),
  );
  const overdueText = findValue(lines, [
    "Parcelas em atraso",
    "Parcela em atraso",
    "Atraso",
  ]);
  const contractInHands = findValue(lines, [
    "Contrato em mãos",
    "Contrato em maos",
    "Possui contrato",
  ]);
  const { vehicle, year } = splitVehicleAndYear(vehicleRaw);

  if (clientName) {
    fields.client_name = clientName;
    addSummary(summary, "Cliente", clientName);
  }

  if (fallbackPhone) {
    fields.client_phone = formatPhone(fallbackPhone);
    addSummary(summary, "Telefone", formatPhone(fallbackPhone));
  }

  if (bank) {
    fields.financial_institution = bank;
    addSummary(summary, "Banco", bank);
  }

  if (vehicle) {
    fields.vehicle = vehicle;
    addSummary(summary, "Veículo", vehicle);
  }

  if (yearRaw || year) {
    fields.vehicle_year = yearRaw ?? year;
    addSummary(summary, "Ano", fields.vehicle_year);
  }

  if (cashValue) {
    fields.cash_value = cashValue;
    addSummary(summary, "Valor do bem", cashValue);
  }

  if (downPayment) {
    fields.down_payment = downPayment;
    addSummary(summary, "Entrada", downPayment);
  }

  if (financedValue) {
    fields.financed_value = financedValue;
    addSummary(summary, "Valor financiado", financedValue);
  }

  if (currentInstallment) {
    fields.current_installment_value = currentInstallment;
    addSummary(summary, "Parcela atual", currentInstallment);
  }

  if (installmentCount) {
    fields.installment_count = installmentCount;
    addSummary(summary, "Total de parcelas", installmentCount);
  }

  if (paidInstallments) {
    fields.paid_installments = paidInstallments;
    addSummary(summary, "Parcelas pagas", paidInstallments);
  }

  const noteLines = [
    dueDay ? `Dia de vencimento informado no Totalk: ${dueDay}.` : null,
    overdueText ? `Atraso informado no Totalk: ${overdueText}.` : null,
    contractInHands ? `Contrato em mãos: ${contractInHands}.` : null,
  ].filter(Boolean);

  if (noteLines.length) {
    fields.notes = noteLines.join("\n");
  }

  if (fields.simulation_type === "veiculo" && cashValue && !downPayment && !financedValue) {
    warnings.push(
      "O Totalk informou valor do veículo, mas não informou entrada nem valor financiado. Confira o valor financiado antes de salvar.",
    );
  }

  const missingFields = Object.entries(requiredFieldLabels)
    .filter(([fieldName]) => {
      if (fieldName === "financed_value") {
        return !fields.financed_value && !fields.cash_value;
      }

      return !fields[fieldName as keyof FinancingCalculationFormValues];
    })
    .map(([, label]) => label);

  return {
    fields,
    summary,
    missingFields,
    warnings,
  };
}
