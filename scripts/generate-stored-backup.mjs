import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

const backupFormat = "grs-crm-backup";
const backupFormatVersion = 1;
const backupRetentionDays = 7;
const backupQueryPageSize = 1000;
const backupBucketName = "backups";
const calculationReportsBucketName = "calculation-reports";
const staleRunningBackupMinutes = 20;
const storageDownloadAttempts = 5;
const storageRetryBaseDelayMs = 2000;

const backupRestoreOrder = [
  "companies",
  "user_profiles",
  "legal_workflow_stages",
  "finance_categories",
  "finance_accounts",
  "finance_transactions",
  "finance_sales",
  "finance_chargebacks",
  "finance_import_batches",
  "finance_import_rows",
  "finance_audit_logs",
  "clients",
  "pre_sales",
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
  "financing_calculations",
  "document_templates",
  "generated_documents",
  "client_documents",
  "client_timeline_events",
  "client_tracking_updates",
  "email_templates",
  "email_logs",
  "email_integrations",
  "company_audit_logs",
  "legacy_rd_import",
  "rd_crm_activity_import_batches",
  "rd_crm_activity_import",
  "legal_workflow_bulk_moves",
  "legal_workflow_bulk_move_items",
];
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

const preSaleChildTables = [
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
];

const companyScopedTables = backupRestoreOrder.filter(
  (table) => !preSaleChildTables.includes(table),
);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel ${name} e obrigatoria.`);
  }

  return value;
}

function getBackupStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}-${getPart("hour")}-${getPart("minute")}`;
}

function getBackupExpirationDate(date = new Date()) {
  const expiration = new Date(date);
  expiration.setDate(expiration.getDate() + backupRetentionDays);
  return expiration.toISOString();
}

function getBackupStoragePath(companyId, backupName) {
  const date = backupName.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? getBackupStamp().slice(0, 10);

  return `${companyId}/${date.slice(0, 4)}/${date.slice(5, 7)}/${backupName}.zip`;
}

function safeBackupPath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"|?*\x00-\x1F]/g, "_"))
    .join("/");
}

function addStorageRef(refs, bucket, value, source) {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }

  refs.push({
    bucket,
    path: value.trim(),
    source,
  });
}

function dedupeStorageRefs(refs) {
  const seen = new Set();

  return refs.filter((ref) => {
    const key = `${ref.bucket}:${ref.path}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function downloadStorageFileWithRetry(supabase, ref) {
  let lastError = "Arquivo nao retornado pelo Storage.";

  for (let attempt = 1; attempt <= storageDownloadAttempts; attempt += 1) {
    try {
      const { data, error } = await supabase.storage
        .from(ref.bucket)
        .download(ref.path);

      if (error || !data) {
        throw new Error(error?.message ?? lastError);
      }

      return {
        buffer: Buffer.from(await data.arrayBuffer()),
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;

      if (attempt < storageDownloadAttempts) {
        const delayMs = storageRetryBaseDelayMs * attempt;
        console.log(
          `falhou (${lastError}). Tentativa ${attempt + 1}/${storageDownloadAttempts} em ${delayMs / 1000}s...`,
        );
        await wait(delayMs);
      }
    }
  }

  throw new Error(lastError);
}

async function fetchAllRows(queryBuilder) {
  const rows = [];

  for (let from = 0; ; from += backupQueryPageSize) {
    const to = from + backupQueryPageSize - 1;
    const { data, error } = await queryBuilder().range(from, to);

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

async function exportCompanyTable(supabase, table, companyId) {
  const result = await fetchAllRows(() => {
    const query = supabase.from(table).select("*");

    return table === "companies"
      ? query.eq("id", companyId)
      : query.eq("company_id", companyId);
  });

  return {
    table,
    rows: result.rows,
    error:
      optionalWorkflowTables.has(table) &&
      result.error &&
      (
        result.error.toLowerCase().includes("does not exist") ||
        result.error.toLowerCase().includes("schema cache") ||
        result.error.toLowerCase().includes("could not find")
      )
        ? null
        : result.error,
  };
}

async function exportPreSaleChildTable(supabase, table, preSaleIds) {
  if (!preSaleIds.length) {
    return {
      table,
      rows: [],
      error: null,
    };
  }

  const rows = [];

  for (let index = 0; index < preSaleIds.length; index += 500) {
    const chunk = preSaleIds.slice(index, index + 500);
    const result = await fetchAllRows(() =>
      supabase.from(table).select("*").in("pre_sale_id", chunk),
    );

    if (result.error) {
      return {
        table,
        rows,
        error: result.error,
      };
    }

    rows.push(...result.rows);
  }

  return {
    table,
    rows,
    error: null,
  };
}

function collectStorageRefs(tables) {
  const refs = [];
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
    addStorageRef(refs, "documents", row.logo_path, "companies.logo_path");
  }

  for (const row of templateRows) {
    addStorageRef(
      refs,
      "documents",
      row.original_docx_path,
      "document_templates.original_docx_path",
    );
    addStorageRef(
      refs,
      "documents",
      row.original_pdf_path,
      "document_templates.original_pdf_path",
    );
  }

  for (const row of generatedDocumentRows) {
    addStorageRef(
      refs,
      "documents",
      row.generated_docx_path,
      "generated_documents.generated_docx_path",
    );
    addStorageRef(
      refs,
      "documents",
      row.generated_pdf_path,
      "generated_documents.generated_pdf_path",
    );
  }

  for (const row of calculationRows) {
    addStorageRef(
      refs,
      calculationReportsBucketName,
      row.pdf_storage_path,
      "financing_calculations.pdf_storage_path",
    );
  }

  for (const row of clientDocumentRows) {
    addStorageRef(
      refs,
      "client-documents",
      row.file_path,
      "client_documents.file_path",
    );
  }

  return dedupeStorageRefs(refs);
}

async function prepareBackupData({ supabase, companyId, generatedBy }) {
  const backupStamp = getBackupStamp();
  const backupName = `backup-grscrm-${backupStamp}`;
  const tables = [];

  for (const table of companyScopedTables) {
    process.stdout.write(`Exportando tabela ${table}... `);
    const exported = await exportCompanyTable(supabase, table, companyId);
    tables.push(exported);
    console.log(`${exported.rows.length} linha(s)${exported.error ? ` - erro: ${exported.error}` : ""}`);
  }

  const preSales = tables.find((item) => item.table === "pre_sales")?.rows ?? [];
  const preSaleIds = preSales
    .map((row) => row.id)
    .filter((id) => typeof id === "string");

  for (const table of preSaleChildTables) {
    process.stdout.write(`Exportando tabela ${table}... `);
    const exported = await exportPreSaleChildTable(supabase, table, preSaleIds);
    tables.push(exported);
    console.log(`${exported.rows.length} linha(s)${exported.error ? ` - erro: ${exported.error}` : ""}`);
  }

  return {
    generated_at: new Date().toISOString(),
    backup_name: backupName,
    backup_root: backupName,
    company_id: companyId,
    generated_by: generatedBy,
    signed_url_expires_in_seconds: 60 * 60,
    tables,
    storage_refs: collectStorageRefs(tables),
  };
}

function writeDatabaseFiles(zip, prepared) {
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

async function addStorageBinariesToZip({ supabase, zip, prepared }) {
  const errors = [];
  let downloadedFiles = 0;
  let current = 0;

  for (const ref of prepared.storage_refs) {
    current += 1;
    process.stdout.write(
      `Baixando arquivo ${current}/${prepared.storage_refs.length}: ${ref.bucket}/${ref.path}... `,
    );

    try {
      const result = await downloadStorageFileWithRetry(supabase, ref);

      zip.file(
        `${prepared.backup_root}/arquivos/${ref.bucket}/${safeBackupPath(ref.path)}`,
        result.buffer,
      );
      downloadedFiles += 1;
      console.log(result.attempts > 1 ? `ok apos ${result.attempts} tentativas` : "ok");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Arquivo nao retornado pelo Storage.";

      console.log(`erro definitivo: ${message}`);
      errors.push({
        ...ref,
        error: message,
      });
    }
  }

  return {
    downloadedFiles,
    errors,
  };
}

function buildManifest({ prepared, downloadedFiles, storageErrors }) {
  return {
    backup_format: backupFormat,
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
      mode: "embedded_binaries",
      requested_files: prepared.storage_refs.length,
      downloadable_files: prepared.storage_refs.length,
      downloaded_files: downloadedFiles,
      backup_contains_storage_inventory: true,
      backup_contains_storage_binaries: true,
      errors: storageErrors,
    },
  };
}

async function buildFullBackupZip({ supabase, prepared }) {
  const zip = new JSZip();

  writeDatabaseFiles(zip, prepared);

  const storageResult = await addStorageBinariesToZip({
    supabase,
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
    downloadedFiles: storageResult.downloadedFiles,
    storageErrors: storageResult.errors,
  });

  zip.file(
    `${prepared.backup_root}/manifest.json`,
    JSON.stringify(manifest, null, 2),
  );

  console.log("Compactando ZIP final...");

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

async function cleanupExpiredBackups(supabase) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("backup_jobs")
    .select("id, storage_bucket, storage_path")
    .lt("expires_at", now);

  if (error) {
    throw new Error(`Nao foi possivel limpar backups vencidos: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (row.storage_path && row.storage_bucket !== "github-releases") {
      await supabase.storage
        .from(row.storage_bucket ?? backupBucketName)
        .remove([row.storage_path]);
    }
  }

  if (data?.length) {
    await supabase.from("backup_jobs").delete().in(
      "id",
      data.map((row) => row.id),
    );
  }
}

async function markStaleRunningBackups(supabase) {
  const staleBefore = new Date();
  staleBefore.setMinutes(staleBefore.getMinutes() - staleRunningBackupMinutes);

  const { error } = await supabase
    .from("backup_jobs")
    .update({
      status: "failed",
      error_message:
        "Geracao interrompida por tempo excedido. Gere um novo backup manual completo.",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", staleBefore.toISOString());

  if (error) {
    throw new Error(`Nao foi possivel atualizar backups travados: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyId = args["company-id"];
  const requestedBy = args["created-by"] ?? null;
  const saveLocalDir = args["save-local-dir"];
  const destination = args.destination ?? "supabase";
  const triggerType = args["trigger-type"] === "scheduled" ? "scheduled" : "manual";
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!companyId || typeof companyId !== "string") {
    throw new Error("Informe --company-id.");
  }

  if (!["supabase", "github-release"].includes(destination)) {
    throw new Error("Destino invalido. Use --destination supabase ou github-release.");
  }

  if (destination === "github-release" && typeof saveLocalDir !== "string") {
    throw new Error(
      "O destino github-release exige --save-local-dir para guardar o ZIP.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await markStaleRunningBackups(supabase);
  await cleanupExpiredBackups(supabase);

  const prepared = await prepareBackupData({
    supabase,
    companyId,
    generatedBy: typeof requestedBy === "string" ? requestedBy : null,
  });
  const tableErrors = prepared.tables.filter((table) => table.error);

  if (tableErrors.length) {
    throw new Error(
      `Backup interrompido: ${tableErrors.length} tabela(s) apresentaram erro. ${tableErrors
        .slice(0, 3)
        .map((table) => `${table.table}: ${table.error}`)
        .join("; ")}`,
    );
  }

  const zip = await buildFullBackupZip({
    supabase,
    prepared,
  });

  if (typeof saveLocalDir === "string") {
    await fs.mkdir(saveLocalDir, { recursive: true });
    await fs.writeFile(path.join(saveLocalDir, `${prepared.backup_name}.zip`), zip.content);
  }

  if (destination === "github-release") {
    const metadataPath = path.join(saveLocalDir, "backup-metadata.json");

    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          backup_name: prepared.backup_name,
          file_name: `${prepared.backup_name}.zip`,
          file_size_bytes: zip.content.byteLength,
          company_id: companyId,
          requested_by: typeof requestedBy === "string" ? requestedBy : null,
          trigger_type: triggerType,
          manifest: zip.manifest,
        },
        null,
        2,
      ),
    );

    console.log("");
    console.log("Backup preparado para publicacao em uma Release privada do GitHub.");
    console.log(`Metadados: ${metadataPath}`);
    return;
  }

  const storagePath = getBackupStoragePath(companyId, prepared.backup_name);
  const { data: job, error: createError } = await supabase
    .from("backup_jobs")
    .insert({
      company_id: companyId,
      requested_by: typeof requestedBy === "string" ? requestedBy : null,
      trigger_type: triggerType,
      status: "running",
      backup_name: prepared.backup_name,
      storage_bucket: backupBucketName,
      storage_path: storagePath,
      expires_at: getBackupExpirationDate(),
    })
    .select("id")
    .single();

  if (createError || !job) {
    throw new Error(createError?.message ?? "Nao foi possivel criar o registro do backup.");
  }

  try {
    console.log(`Enviando ZIP para Supabase Storage: ${storagePath}`);
    const { error: uploadError } = await supabase.storage
      .from(backupBucketName)
      .upload(storagePath, zip.content, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: updateError } = await supabase
      .from("backup_jobs")
      .update({
        status: "completed",
        file_size_bytes: zip.content.byteLength,
        manifest: zip.manifest,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log("");
    console.log("Backup concluido e disponivel na tela de Backups.");
    console.log(
      JSON.stringify(
        {
          id: job.id,
          backup_name: prepared.backup_name,
          storage_path: storagePath,
          file_size_bytes: zip.content.byteLength,
          requested_files: zip.manifest.storage.requested_files,
          downloaded_files: zip.manifest.storage.downloaded_files,
          storage_errors: zip.manifest.storage.errors.length,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao gerar backup.";

    await supabase
      .from("backup_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    throw error;
  }
}

main().catch((error) => {
  console.error("Erro:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
