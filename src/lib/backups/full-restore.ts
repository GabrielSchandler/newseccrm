import { backupRestoreOrder } from "@/lib/backups/format";
import {
  getRowString,
  isBackupRow,
  safeBackupPath,
  type BackupRow,
} from "@/lib/backups/client-restore";

export const fullRestoreConfirmationText = "RESTAURAR SISTEMA COMPLETO";

export type FullRestoreTable = (typeof backupRestoreOrder)[number];
export type FullRestoreRows = Partial<Record<FullRestoreTable, BackupRow[]>>;

export const fullRestoreStorageColumns = [
  {
    table: "companies",
    bucket: "documents",
    columns: ["logo_path"],
  },
  {
    table: "document_templates",
    bucket: "documents",
    columns: ["original_docx_path", "original_pdf_path"],
  },
  {
    table: "generated_documents",
    bucket: "documents",
    columns: ["generated_docx_path", "generated_pdf_path"],
  },
  {
    table: "financing_calculations",
    bucket: "calculation-reports",
    columns: ["pdf_storage_path"],
  },
  {
    table: "client_documents",
    bucket: "client-documents",
    columns: ["file_path"],
  },
] as const;

export const fullRestoreAllowedBuckets = [
  "documents",
  "client-documents",
  "calculation-reports",
] as const;

export type FullRestoreBucket = (typeof fullRestoreAllowedBuckets)[number];

export type FullRestoreFile = {
  bucket: FullRestoreBucket;
  originalPath: string;
  targetPath: string;
  zipPath: string;
  size: number;
  type: string;
};

export type StorageInventoryRef = {
  bucket?: unknown;
  path?: unknown;
  source?: unknown;
};

export function isAllowedFullRestoreBucket(bucket: string): bucket is FullRestoreBucket {
  return (fullRestoreAllowedBuckets as readonly string[]).includes(bucket);
}

export function getRowsByFullRestoreTable(
  rows: FullRestoreRows,
  table: FullRestoreTable,
) {
  return rows[table] ?? [];
}

export function countFullRestoreRows(rows: FullRestoreRows) {
  return backupRestoreOrder.reduce(
    (total, table) => total + getRowsByFullRestoreTable(rows, table).length,
    0,
  );
}

export function getCompanyIdFromRow(row: BackupRow) {
  return getRowString(row, "company_id");
}

export function normalizeStorageInventoryRef(ref: StorageInventoryRef) {
  const bucket = typeof ref.bucket === "string" ? ref.bucket : "";
  const path = typeof ref.path === "string" ? safeBackupPath(ref.path) : "";

  if (!isAllowedFullRestoreBucket(bucket) || !path) {
    return null;
  }

  return {
    bucket,
    path,
    source: typeof ref.source === "string" ? ref.source : null,
  };
}

export function normalizeBackupRows(value: unknown) {
  return Array.isArray(value) ? value.filter(isBackupRow) : [];
}
