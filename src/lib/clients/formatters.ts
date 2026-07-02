import { formatCpf, formatPhone } from "./masks";

export function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function displayValue(value: string | null) {
  return value && value.trim() ? value : "-";
}

export function displayCpf(value: string | null) {
  const formatted = formatCpf(value);
  return formatted || "-";
}

export function displayPhone(value: string | null) {
  return value ? formatPhone(value) : "-";
}
