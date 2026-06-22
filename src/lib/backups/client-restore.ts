export const clientRestoreConfirmationText = "RESTAURAR CLIENTE";

export const clientRestoreTableOrder = [
  "legal_workflow_stages",
  "document_templates",
  "email_templates",
  "rd_crm_activity_import_batches",
  "clients",
  "pre_sales",
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
  "financing_calculations",
  "generated_documents",
  "client_documents",
  "client_timeline_events",
  "client_tracking_updates",
  "email_logs",
  "legacy_rd_import",
  "rd_crm_activity_import",
] as const;

export type ClientRestoreTable = (typeof clientRestoreTableOrder)[number];

export const clientRestoreDataTables = [
  "legal_workflow_stages",
  "clients",
  "pre_sales",
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
  "financing_calculations",
  "generated_documents",
  "client_documents",
  "client_timeline_events",
  "client_tracking_updates",
  "email_logs",
  "legacy_rd_import",
  "rd_crm_activity_import",
] as const;

export const clientRestoreStorageColumns = [
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

export const clientRestoreAllowedBuckets = [
  "documents",
  "client-documents",
  "calculation-reports",
] as const;

export type ClientRestoreBucket = (typeof clientRestoreAllowedBuckets)[number];

export type BackupRow = Record<string, unknown>;

export type ClientRestoreRows = Partial<Record<ClientRestoreTable, BackupRow[]>>;

export type ClientRestoreFile = {
  bucket: ClientRestoreBucket;
  originalPath: string;
  targetPath: string;
  zipPath: string;
  size: number;
  type: string;
};

export function normalizeCpf(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function safeBackupPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

export function isBackupRow(value: unknown): value is BackupRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getRowString(row: BackupRow, field: string) {
  const value = row[field];
  return typeof value === "string" ? value : "";
}

export function getRowId(row: BackupRow) {
  return getRowString(row, "id");
}

export function getRowsByTable(rows: ClientRestoreRows, table: ClientRestoreTable) {
  return rows[table] ?? [];
}

export function countClientRestoreRows(rows: ClientRestoreRows) {
  return clientRestoreTableOrder.reduce(
    (total, table) => total + getRowsByTable(rows, table).length,
    0,
  );
}
