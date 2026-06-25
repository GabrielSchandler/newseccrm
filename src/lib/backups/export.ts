import "server-only";
import JSZip from "jszip";
import {
  backupFormatVersion,
  backupRetentionDays,
  backupRestoreOrder,
  grsBackupFormat,
} from "@/lib/backups/format";
import { safeBackupPath } from "@/lib/backups/client-restore";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExportedTable = {
  table: string;
  rows: unknown[];
  error: string | null;
};

export type StorageFileRef = {
  bucket: string;
  path: string;
  source: string;
};

export type SignedStorageFile = StorageFileRef & {
  zip_path: string;
  signed_url: string | null;
  error: string | null;
};

export type PreparedBackup = {
  generated_at: string;
  backup_name: string;
  backup_root: string;
  company_id: string;
  generated_by: string | null;
  signed_url_expires_in_seconds: number;
  tables: ExportedTable[];
  storage_refs: StorageFileRef[];
};

export const backupBucketName = "backups";
export const signedUrlExpiresInSeconds = 60 * 60;
const calculationReportsBucketName = "calculation-reports";
const storageDownloadAttempts = 5;
const storageRetryBaseDelayMs = 2000;

const companyScopedTables = backupRestoreOrder.filter(
  (table) =>
    ![
      "pre_sale_client_snapshot",
      "pre_sale_debt_holders",
      "pre_sale_financial_cases",
      "pre_sale_payments",
    ].includes(table),
);

const preSaleChildTables = [
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
] as const;
const backupQueryPageSize = 1000;
const optionalWorkflowTables = new Set([
  "legal_workflow_stages",
  "legal_workflow_bulk_moves",
  "legal_workflow_bulk_move_items",
  "finance_categories",
  "finance_accounts",
  "finance_transactions",
  "finance_sales",
  "finance_chargebacks",
  "finance_import_batches",
  "finance_import_rows",
  "finance_audit_logs",
]);

function isMissingOptionalWorkflowTable(table: string, error: string | null) {
  if (!optionalWorkflowTables.has(table) || !error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find")
  );
}

type PagedSelectQuery = {
  eq(column: string, value: unknown): PagedSelectQuery;
  in(column: string, values: unknown[]): PagedSelectQuery;
  range(
    from: number,
    to: number,
  ): PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};

async function fetchAllBackupRows(buildQuery: () => PagedSelectQuery) {
  const rows: unknown[] = [];

  for (let from = 0; ; from += backupQueryPageSize) {
    const to = from + backupQueryPageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      return {
        rows,
        error: error.message,
      };
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < backupQueryPageSize) {
      break;
    }
  }

  return {
    rows,
    error: null,
  };
}

export function getBackupStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}-${getPart("hour")}-${getPart("minute")}`;
}

export function safeZipPath(path: string) {
  return safeBackupPath(path);
}

function addStorageRef(
  refs: StorageFileRef[],
  bucket: string,
  path: unknown,
  source: string,
) {
  if (typeof path !== "string" || !path.trim()) {
    return;
  }

  refs.push({
    bucket,
    path: path.trim(),
    source,
  });
}

function dedupeStorageRefs(refs: StorageFileRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.bucket}:${ref.path}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function downloadStorageFileWithRetry({
  adminClient,
  ref,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  ref: StorageFileRef;
}) {
  let lastError = "Arquivo nao retornado pelo Storage.";

  for (let attempt = 1; attempt <= storageDownloadAttempts; attempt += 1) {
    try {
      const { data, error } = await adminClient.storage
        .from(ref.bucket)
        .download(ref.path);

      if (error || !data) {
        throw new Error(error?.message ?? lastError);
      }

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;

      if (attempt < storageDownloadAttempts) {
        await wait(storageRetryBaseDelayMs * attempt);
      }
    }
  }

  throw new Error(lastError);
}

async function exportCompanyTable(
  adminClient: ReturnType<typeof createAdminClient>,
  table: string,
  companyId: string,
) {
  const result = await fetchAllBackupRows(() => {
    const query = adminClient
      .from(table)
      .select("*") as unknown as PagedSelectQuery;

    return table === "companies"
      ? query.eq("id", companyId)
      : query.eq("company_id", companyId);
  });

  return {
    table,
    rows: result.rows,
    error: isMissingOptionalWorkflowTable(table, result.error)
      ? null
      : result.error,
  } satisfies ExportedTable;
}

async function exportPreSaleChildTable(
  adminClient: ReturnType<typeof createAdminClient>,
  table: string,
  preSaleIds: string[],
) {
  if (!preSaleIds.length) {
    return {
      table,
      rows: [],
      error: null,
    } satisfies ExportedTable;
  }

  const rows: unknown[] = [];

  for (let index = 0; index < preSaleIds.length; index += 500) {
    const chunk = preSaleIds.slice(index, index + 500);
    const result = await fetchAllBackupRows(() =>
      (
        adminClient.from(table).select("*") as unknown as PagedSelectQuery
      ).in("pre_sale_id", chunk),
    );

    if (result.error) {
      return {
        table,
        rows,
        error: result.error,
      } satisfies ExportedTable;
    }

    rows.push(...result.rows);
  }

  return {
    table,
    rows,
    error: null,
  } satisfies ExportedTable;
}

function collectStorageRefs(tables: ExportedTable[]) {
  const refs: StorageFileRef[] = [];
  const companyRows = tables.find((item) => item.table === "companies")?.rows ?? [];
  const templateRows =
    tables.find((item) => item.table === "document_templates")?.rows ?? [];
  const generatedDocumentRows =
    tables.find((item) => item.table === "generated_documents")?.rows ?? [];
  const clientDocumentRows =
    tables.find((item) => item.table === "client_documents")?.rows ?? [];
  const calculationRows =
    tables.find((item) => item.table === "financing_calculations")?.rows ?? [];

  for (const row of companyRows) {
    addStorageRef(
      refs,
      "documents",
      (row as { logo_path?: unknown }).logo_path,
      "companies.logo_path",
    );
  }

  for (const row of templateRows) {
    addStorageRef(
      refs,
      "documents",
      (row as { original_docx_path?: unknown }).original_docx_path,
      "document_templates.original_docx_path",
    );
    addStorageRef(
      refs,
      "documents",
      (row as { original_pdf_path?: unknown }).original_pdf_path,
      "document_templates.original_pdf_path",
    );
  }

  for (const row of generatedDocumentRows) {
    addStorageRef(
      refs,
      "documents",
      (row as { generated_docx_path?: unknown }).generated_docx_path,
      "generated_documents.generated_docx_path",
    );
    addStorageRef(
      refs,
      "documents",
      (row as { generated_pdf_path?: unknown }).generated_pdf_path,
      "generated_documents.generated_pdf_path",
    );
  }

  for (const row of calculationRows) {
    addStorageRef(
      refs,
      calculationReportsBucketName,
      (row as { pdf_storage_path?: unknown }).pdf_storage_path,
      "financing_calculations.pdf_storage_path",
    );
  }

  for (const row of clientDocumentRows) {
    addStorageRef(
      refs,
      "client-documents",
      (row as { file_path?: unknown }).file_path,
      "client_documents.file_path",
    );
  }

  return dedupeStorageRefs(refs);
}

export async function prepareBackupData({
  adminClient,
  companyId,
  generatedBy,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  companyId: string;
  generatedBy: string | null;
}) {
  const backupStamp = getBackupStamp();
  const backupName = `backup-grscrm-${backupStamp}`;
  const tables: ExportedTable[] = [];

  for (const table of companyScopedTables) {
    tables.push(await exportCompanyTable(adminClient, table, companyId));
  }

  const preSales = tables.find((item) => item.table === "pre_sales")?.rows ?? [];
  const preSaleIds = preSales
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");

  for (const table of preSaleChildTables) {
    tables.push(await exportPreSaleChildTable(adminClient, table, preSaleIds));
  }

  return {
    generated_at: new Date().toISOString(),
    backup_name: backupName,
    backup_root: backupName,
    company_id: companyId,
    generated_by: generatedBy,
    signed_url_expires_in_seconds: signedUrlExpiresInSeconds,
    tables,
    storage_refs: collectStorageRefs(tables),
  } satisfies PreparedBackup;
}

export async function signStorageRefs({
  adminClient,
  backupRoot,
  refs,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  backupRoot: string;
  refs: StorageFileRef[];
}) {
  const signedFiles: SignedStorageFile[] = [];
  const refsByBucket = new Map<string, StorageFileRef[]>();

  for (const ref of refs) {
    const bucketRefs = refsByBucket.get(ref.bucket) ?? [];
    bucketRefs.push(ref);
    refsByBucket.set(ref.bucket, bucketRefs);
  }

  for (const [bucket, bucketRefs] of refsByBucket) {
    const paths = bucketRefs.map((ref) => ref.path);
    const { data, error } = await adminClient.storage
      .from(bucket)
      .createSignedUrls(paths, signedUrlExpiresInSeconds);
    const signedUrlByPath = new Map(
      (data ?? []).map((item) => [item.path, item.signedUrl ?? null]),
    );

    for (const ref of bucketRefs) {
      signedFiles.push({
        ...ref,
        zip_path: `${backupRoot}/arquivos/${ref.bucket}/${safeZipPath(ref.path)}`,
        signed_url: signedUrlByPath.get(ref.path) ?? null,
        error: error?.message ?? null,
      });
    }
  }

  return signedFiles;
}

function buildManifest({
  prepared,
  storageMode,
  downloadedFiles,
  storageErrors = [],
}: {
  prepared: PreparedBackup;
  storageMode: "embedded_binaries" | "inventory_only";
  downloadedFiles: number;
  storageErrors?: unknown[];
}) {
  return {
    backup_format: grsBackupFormat,
    backup_format_version: backupFormatVersion,
    generated_at: prepared.generated_at,
    backup_name: prepared.backup_name,
    backup_root: prepared.backup_root,
    company_id: prepared.company_id,
    generated_by: prepared.generated_by,
    signed_url_expires_in_seconds: prepared.signed_url_expires_in_seconds,
    retention_days: backupRetentionDays,
    restore_order: backupRestoreOrder,
    tables: prepared.tables.map((table) => ({
      table: table.table,
      rows: table.rows.length,
      error: table.error,
    })),
    storage: {
      mode: storageMode,
      requested_files: prepared.storage_refs.length,
      downloadable_files: prepared.storage_refs.length,
      downloaded_files: downloadedFiles,
      backup_contains_storage_inventory: true,
      backup_contains_storage_binaries: storageMode === "embedded_binaries",
      errors: storageErrors,
    },
  };
}

function writeDatabaseFiles(zip: JSZip, prepared: PreparedBackup) {
  for (const table of prepared.tables) {
    zip.file(
      `${prepared.backup_root}/banco/${table.table}.json`,
      JSON.stringify(
        {
          table: table.table,
          exported_at: prepared.generated_at,
          error: table.error,
          rows: table.rows,
        },
        null,
        2,
      ),
    );
  }

  zip.file(
    `${prepared.backup_root}/storage-files.json`,
    JSON.stringify(prepared.storage_refs, null, 2),
  );
}

async function addStorageBinariesToZip({
  adminClient,
  zip,
  prepared,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  zip: JSZip;
  prepared: PreparedBackup;
}) {
  const errors: Array<StorageFileRef & { error: string }> = [];
  let downloadedFiles = 0;

  for (const ref of prepared.storage_refs) {
    try {
      const buffer = await downloadStorageFileWithRetry({
        adminClient,
        ref,
      });

      zip.file(
        `${prepared.backup_root}/arquivos/${ref.bucket}/${safeZipPath(ref.path)}`,
        buffer,
      );
      downloadedFiles += 1;
    } catch (error) {
      errors.push({
        ...ref,
        error:
          error instanceof Error
            ? error.message
            : "Arquivo nao retornado pelo Storage.",
      });
    }
  }

  return {
    downloadedFiles,
    errors,
  };
}

export async function buildFullBackupZip({
  adminClient,
  prepared,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  prepared: PreparedBackup;
}) {
  const zip = new JSZip();
  const tableErrors = prepared.tables.filter((table) => table.error);

  if (tableErrors.length) {
    throw new Error(
      `Backup interrompido: ${tableErrors.length} tabela(s) apresentaram erro. ${tableErrors
        .slice(0, 3)
        .map((table) => `${table.table}: ${table.error}`)
        .join("; ")}`,
    );
  }

  writeDatabaseFiles(zip, prepared);

  const storageResult = await addStorageBinariesToZip({
    adminClient,
    zip,
    prepared,
  });

  if (storageResult.errors.length) {
    const examples = storageResult.errors
      .slice(0, 3)
      .map((item) => `${item.bucket}/${item.path}: ${item.error}`)
      .join("; ");

    throw new Error(
      `Backup incompleto: ${storageResult.errors.length} arquivo(s) nao puderam ser baixados apos ${storageDownloadAttempts} tentativas. ${examples}`,
    );
  }

  const manifest = buildManifest({
    prepared,
    storageMode: "embedded_binaries",
    downloadedFiles: storageResult.downloadedFiles,
    storageErrors: storageResult.errors,
  });

  zip.file(
    `${prepared.backup_root}/manifest.json`,
    JSON.stringify(manifest, null, 2),
  );

  return {
    content: Buffer.from(
      await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      }),
    ),
    manifest,
  };
}

export async function buildDatabaseBackupZip(prepared: PreparedBackup) {
  const zip = new JSZip();

  writeDatabaseFiles(zip, prepared);

  const manifest = buildManifest({
    prepared,
    storageMode: "inventory_only",
    downloadedFiles: 0,
  });

  zip.file(
    `${prepared.backup_root}/manifest.json`,
    JSON.stringify(manifest, null, 2),
  );

  return {
    content: Buffer.from(
      await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      }),
    ),
    manifest,
  };
}

export function getBackupStoragePath(companyId: string, backupName: string) {
  const date = backupName.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? getBackupStamp().slice(0, 10);

  return `${companyId}/${date.slice(0, 4)}/${date.slice(5, 7)}/${backupName}.zip`;
}

export function getBackupExpirationDate(date = new Date()) {
  const expiration = new Date(date);
  expiration.setDate(expiration.getDate() + backupRetentionDays);
  return expiration.toISOString();
}
