import "server-only";
import JSZip from "jszip";
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
export const backupRetentionDays = 7;
export const signedUrlExpiresInSeconds = 60 * 60;

const companyScopedTables = [
  "companies",
  "user_profiles",
  "clients",
  "pre_sales",
  "client_documents",
  "document_templates",
  "generated_documents",
  "financing_calculations",
  "client_timeline_events",
  "client_tracking_updates",
  "email_templates",
  "email_logs",
  "email_integrations",
  "company_audit_logs",
  "legacy_rd_import",
  "rd_crm_activity_import_batches",
  "rd_crm_activity_import",
] as const;

const preSaleChildTables = [
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
] as const;

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
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
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

async function exportCompanyTable(
  adminClient: ReturnType<typeof createAdminClient>,
  table: string,
  companyId: string,
) {
  const query = adminClient.from(table).select("*");
  const filteredQuery =
    table === "companies"
      ? query.eq("id", companyId)
      : query.eq("company_id", companyId);
  const { data, error } = await filteredQuery;

  return {
    table,
    rows: data ?? [],
    error: error?.message ?? null,
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
    const { data, error } = await adminClient
      .from(table)
      .select("*")
      .in("pre_sale_id", chunk);

    if (error) {
      return {
        table,
        rows,
        error: error.message,
      } satisfies ExportedTable;
    }

    rows.push(...(data ?? []));
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
      "documents",
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

function buildManifest(prepared: PreparedBackup, storageErrors: unknown[] = []) {
  return {
    generated_at: prepared.generated_at,
    backup_name: prepared.backup_name,
    company_id: prepared.company_id,
    generated_by: prepared.generated_by,
    retention_days: backupRetentionDays,
    tables: prepared.tables.map((table) => ({
      table: table.table,
      rows: table.rows.length,
      error: table.error,
    })),
    storage: {
      inventory_files: prepared.storage_refs.length,
      backup_contains_storage_inventory: true,
      backup_contains_storage_binaries: false,
      note: "Este backup automatico salva os dados do CRM e o inventario dos arquivos. Os arquivos binarios seguem no Supabase Storage e entram no backup manual completo.",
      errors: storageErrors,
    },
  };
}

export async function buildDatabaseBackupZip(prepared: PreparedBackup) {
  const zip = new JSZip();

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
  zip.file(
    `${prepared.backup_root}/manifest.json`,
    JSON.stringify(buildManifest(prepared), null, 2),
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
    manifest: buildManifest(prepared),
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
