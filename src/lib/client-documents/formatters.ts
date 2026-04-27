import { clientDocumentTypes, type ClientDocumentType } from "@/types/client-document";

export function formatClientDocumentType(type: ClientDocumentType | string | null) {
  return clientDocumentTypes.find((item) => item.value === type)?.label ?? "Outro";
}

export function formatClientDocumentSize(size: number | null | undefined) {
  const value = Number(size ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function clientDocumentBadgeClass(type: ClientDocumentType | string | null) {
  if (type === "rg" || type === "cpf" || type === "cnh") {
    return "bg-sky-50 text-sky-700";
  }

  if (type === "contrato_assinado" || type === "procuracao") {
    return "bg-teal-50 text-teal-700";
  }

  if (type === "documento_financiamento") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}
