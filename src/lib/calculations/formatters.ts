import { onlyDigits } from "@/lib/clients/masks";
import {
  financingCalculationStatuses,
  type FinancingCalculationStatus,
} from "@/types/calculation";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatCalculationCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Nao informado";
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return "Nao informado";
  }

  return brlFormatter.format(numeric);
}

export function formatCalculationStatus(
  status: FinancingCalculationStatus | string | null,
) {
  return (
    financingCalculationStatuses.find((item) => item.value === status)?.label ??
    "Nao informado"
  );
}

export function formatCpfDigits(value: string | null | undefined) {
  const digits = onlyDigits(value ?? "");

  if (digits.length !== 11) {
    return value ?? "Nao informado";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCalculationDate(value: string | null | undefined) {
  if (!value) {
    return "Nao informado";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function formatCalculationDateTime(value: string | null | undefined) {
  if (!value) {
    return "Nao informado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatFileSize(size: number | null | undefined) {
  if (!size || size <= 0) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
