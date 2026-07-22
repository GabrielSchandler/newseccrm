import {
  clientDocumentTypes,
  normalizeClientDocumentType,
  type ClientDocumentType,
} from "@/types/client-document";

export function formatClientDocumentType(type: ClientDocumentType | string | null) {
  const normalizedType = normalizeClientDocumentType(type);

  return clientDocumentTypes.find((item) => item.value === normalizedType)?.label ?? "Documentação";
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
  const normalizedType = normalizeClientDocumentType(type);

  if (normalizedType === "documentacao") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (normalizedType === "extrajudicial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (normalizedType === "processual") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function clientDocumentGroupAccentClass(type: ClientDocumentType | string | null) {
  const normalizedType = normalizeClientDocumentType(type);

  if (normalizedType === "documentacao") {
    return "bg-sky-500";
  }

  if (normalizedType === "extrajudicial") {
    return "bg-amber-500";
  }

  if (normalizedType === "processual") {
    return "bg-rose-500";
  }

  return "bg-slate-400";
}
