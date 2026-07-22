import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit/log";
import {
  backupFormatVersion,
  backupRestoreOrder,
  grsBackupFormat,
} from "@/lib/backups/format";
import {
  countFullRestoreRows,
  fullRestoreConfirmationText,
  fullRestoreStorageColumns,
  getCompanyIdFromRow,
  getRowsByFullRestoreTable,
  isAllowedFullRestoreBucket,
  type FullRestoreRows,
  type FullRestoreTable,
} from "@/lib/backups/full-restore";
import {
  type BackupRow,
  getRowId,
  getRowString,
  isBackupRow,
  safeBackupPath,
} from "@/lib/backups/client-restore";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type FullRestoreRequest = {
  confirmation?: string;
  manifest?: {
    backup_format?: string;
    backup_format_version?: number;
    backup_name?: string;
    company_id?: string;
    generated_at?: string;
    storage?: {
      errors?: unknown[];
      requested_files?: number;
      downloaded_files?: number;
      backup_contains_storage_binaries?: boolean;
    };
  };
  rows?: FullRestoreRows;
  uploadedFiles?: Array<{
    bucket?: string;
    originalPath?: string;
    targetPath?: string;
  }>;
};

const preSaleChildTables = [
  "pre_sale_client_snapshot",
  "pre_sale_debt_holders",
  "pre_sale_financial_cases",
  "pre_sale_payments",
  "legal_payments",
] as const satisfies readonly FullRestoreTable[];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAdminProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: jsonError("Sessão inválida.", 401),
      profile: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: jsonError("Perfil do usuário não encontrado.", 403),
      profile: null,
    };
  }

  if (profile.role !== "admin") {
    return {
      error: jsonError("Apenas administradores podem restaurar backups.", 403),
      profile: null,
    };
  }

  return {
    error: null,
    profile: {
      id: profile.id as string,
      companyId: profile.company_id as string,
    },
  };
}

function validateManifest(body: FullRestoreRequest, companyId: string) {
  if (body.confirmation !== fullRestoreConfirmationText) {
    return "Confirmação inválida. Digite exatamente RESTAURAR SISTEMA COMPLETO.";
  }

  const manifest = body.manifest;

  if (!manifest) {
    return "O arquivo selecionado não está no formato de backup GRS.";
  }

  if (manifest.backup_format !== grsBackupFormat) {
    return "O arquivo selecionado não está no formato de backup GRS.";
  }

  if (manifest.backup_format_version !== backupFormatVersion) {
    return "A versão do backup não é compatível com esta ferramenta.";
  }

  if (manifest.company_id !== companyId) {
    return "Este backup pertence a outra empresa ou ambiente.";
  }

  if (!manifest.storage?.backup_contains_storage_binaries) {
    return "Este backup não contém os arquivos do Storage embutidos.";
  }

  const storageErrors = Array.isArray(manifest.storage.errors)
    ? manifest.storage.errors.length
    : 0;

  if (storageErrors > 0) {
    return "Este backup possui erros de arquivos no manifesto. Gere um backup completo sem falhas antes de restaurar tudo.";
  }

  return null;
}

function assertRowsAreObjects(rows: FullRestoreRows) {
  for (const table of backupRestoreOrder) {
    const tableRows = getRowsByFullRestoreTable(rows, table);

    if (!Array.isArray(tableRows) || !tableRows.every(isBackupRow)) {
      throw new Error(`Tabela ${table} possui linhas inválidas.`);
    }
  }
}

function assertCompanyScope(rows: FullRestoreRows, companyId: string) {
  const companyRows = getRowsByFullRestoreTable(rows, "companies");

  if (!companyRows.some((row) => getRowId(row) === companyId)) {
    throw new Error("O backup não contem o cadastro da empresa atual.");
  }

  for (const table of backupRestoreOrder) {
    for (const row of getRowsByFullRestoreTable(rows, table)) {
      const rowCompanyId =
        table === "companies" ? getRowId(row) : getCompanyIdFromRow(row);

      if (rowCompanyId && rowCompanyId !== companyId) {
        throw new Error(`Tabela ${table} possui dados de outra empresa.`);
      }
    }
  }
}

function assertUploadedStorageFiles(
  rows: FullRestoreRows,
  uploadedFiles: FullRestoreRequest["uploadedFiles"],
  companyId: string,
) {
  const uploaded = new Set(
    (uploadedFiles ?? []).map((file) => `${file.bucket ?? ""}:${file.targetPath ?? ""}`),
  );

  for (const file of uploadedFiles ?? []) {
    const bucket = String(file.bucket ?? "");
    const path = safeBackupPath(String(file.targetPath ?? ""));

    if (!isAllowedFullRestoreBucket(bucket) || !path) {
      throw new Error("Arquivo enviado com bucket ou caminho inválido.");
    }

    if (!path.startsWith(`${companyId}/`)) {
      throw new Error("Arquivo enviado fora do caminho da empresa atual.");
    }
  }

  for (const spec of fullRestoreStorageColumns) {
    for (const row of getRowsByFullRestoreTable(rows, spec.table)) {
      for (const column of spec.columns) {
        const value = safeBackupPath(getRowString(row, column));

        if (value && !uploaded.has(`${spec.bucket}:${value}`)) {
          throw new Error(
            `Arquivo ${value} não foi enviado antes da restauração do banco.`,
          );
        }
      }
    }
  }
}

function chunkRows(rows: BackupRow[], size = 100) {
  const chunks: BackupRow[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function listExistingPreSaleIds({
  adminClient,
  companyId,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  companyId: string;
}) {
  const ids: string[] = [];
  const { data, error } = await adminClient
    .from("pre_sales")
    .select("id")
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Não foi possível listar pré-vendas atuais: ${error.message}`);
  }

  for (const row of data ?? []) {
    const id = (row as { id?: unknown }).id;

    if (typeof id === "string") {
      ids.push(id);
    }
  }

  return ids;
}

async function deleteTableRows({
  adminClient,
  table,
  companyId,
  existingPreSaleIds,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  table: FullRestoreTable;
  companyId: string;
  existingPreSaleIds: string[];
}) {
  if (table === "companies") {
    return 0;
  }

  if ((preSaleChildTables as readonly string[]).includes(table)) {
    let deleted = 0;

    for (let index = 0; index < existingPreSaleIds.length; index += 500) {
      const ids = existingPreSaleIds.slice(index, index + 500);
      const { error } = await adminClient
        .from(table)
        .delete()
        .in("pre_sale_id", ids);

      if (error) {
        throw new Error(`Falha ao limpar ${table}: ${error.message}`);
      }

      deleted += ids.length;
    }

    return deleted;
  }

  const { error } = await adminClient
    .from(table)
    .delete()
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Falha ao limpar ${table}: ${error.message}`);
  }

  return 0;
}

async function upsertTableRows({
  adminClient,
  table,
  rows,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  table: FullRestoreTable;
  rows: BackupRow[];
}) {
  if (!rows.length) {
    return 0;
  }

  let restored = 0;

  for (const chunk of chunkRows(rows)) {
    const { error } = await adminClient.from(table).upsert(chunk, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`Falha ao restaurar ${table}: ${error.message}`);
    }

    restored += chunk.length;
  }

  return restored;
}

export async function POST(request: Request) {
  const { error, profile } = await getAdminProfile();

  if (error || !profile) {
    return error;
  }

  try {
    const body = (await request.json()) as FullRestoreRequest;
    const manifestError = validateManifest(body, profile.companyId);

    if (manifestError) {
      return jsonError(manifestError);
    }

    const manifest = body.manifest;

    if (!manifest) {
      return jsonError("O arquivo selecionado não está no formato de backup GRS.");
    }

    const rows = body.rows ?? {};

    assertRowsAreObjects(rows);
    assertCompanyScope(rows, profile.companyId);
    assertUploadedStorageFiles(rows, body.uploadedFiles, profile.companyId);

    const adminClient = createAdminClient();
    const existingPreSaleIds = await listExistingPreSaleIds({
      adminClient,
      companyId: profile.companyId,
    });

    for (const table of [...backupRestoreOrder].reverse()) {
      await deleteTableRows({
        adminClient,
        table,
        companyId: profile.companyId,
        existingPreSaleIds,
      });
    }

    const restoredTables: Record<string, number> = {};

    for (const table of backupRestoreOrder) {
      const count = await upsertTableRows({
        adminClient,
        table,
        rows: getRowsByFullRestoreTable(rows, table),
      });

      if (count) {
        restoredTables[table] = count;
      }
    }

    await recordAuditLog({
      supabase: adminClient,
      companyId: profile.companyId,
      userProfileId: null,
      action: "restore_full_backup",
      entityType: "company",
      entityId: profile.companyId,
      entityLabel: manifest.backup_name ?? "backup",
      details: {
        backup_name: manifest.backup_name ?? null,
        backup_generated_at: manifest.generated_at ?? null,
        restored_tables: restoredTables,
        restored_rows: countFullRestoreRows(rows),
        uploaded_files: body.uploadedFiles?.length ?? 0,
      },
    });

    return NextResponse.json({
      ok: true,
      restoredRows: countFullRestoreRows(rows),
      restoredTables,
      uploadedFiles: body.uploadedFiles?.length ?? 0,
    });
  } catch (restoreError) {
    return jsonError(
      restoreError instanceof Error
        ? restoreError.message
        : "Não foi possível restaurar o sistema.",
      500,
    );
  }
}
