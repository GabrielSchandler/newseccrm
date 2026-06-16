import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportedTable = {
  table: string;
  rows: unknown[];
  error: string | null;
};

type StorageFileRef = {
  bucket: string;
  path: string;
  source: string;
};

type SignedStorageFile = StorageFileRef & {
  zip_path: string;
  signed_url: string | null;
  error: string | null;
};

const signedUrlExpiresInSeconds = 60 * 60;

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

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}-${getPart("hour")}-${getPart("minute")}`;
}

function safeZipPath(path: string) {
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

async function signStorageRefs({
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Perfil do usuario nao encontrado." },
      { status: 403 },
    );
  }

  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem gerar backup." },
      { status: 403 },
    );
  }

  const companyId = profile.company_id as string | null;

  if (!companyId) {
    return NextResponse.json(
      { error: "Usuario sem empresa vinculada para gerar backup." },
      { status: 400 },
    );
  }

  const backupStamp = getBackupStamp();
  const backupName = `backup-grscrm-${backupStamp}`;
  const backupRoot = backupName;
  const adminClient = createAdminClient();
  const exportedTables: ExportedTable[] = [];

  for (const table of companyScopedTables) {
    exportedTables.push(await exportCompanyTable(adminClient, table, companyId));
  }

  const preSales =
    exportedTables.find((item) => item.table === "pre_sales")?.rows ?? [];
  const preSaleIds = preSales
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");

  for (const table of preSaleChildTables) {
    exportedTables.push(
      await exportPreSaleChildTable(adminClient, table, preSaleIds),
    );
  }

  const refs: StorageFileRef[] = [];
  const companyRows =
    exportedTables.find((item) => item.table === "companies")?.rows ?? [];
  const templateRows =
    exportedTables.find((item) => item.table === "document_templates")?.rows ??
    [];
  const generatedDocumentRows =
    exportedTables.find((item) => item.table === "generated_documents")?.rows ??
    [];
  const clientDocumentRows =
    exportedTables.find((item) => item.table === "client_documents")?.rows ??
    [];
  const calculationRows =
    exportedTables.find((item) => item.table === "financing_calculations")
      ?.rows ?? [];

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

  const files = await signStorageRefs({
    adminClient,
    backupRoot,
    refs: dedupeStorageRefs(refs),
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      backup_name: backupName,
      backup_root: backupRoot,
      company_id: companyId,
      generated_by: profile.id,
      signed_url_expires_in_seconds: signedUrlExpiresInSeconds,
      tables: exportedTables.map((item) => ({
        table: item.table,
        rows: item.rows,
        error: item.error,
      })),
      files,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
