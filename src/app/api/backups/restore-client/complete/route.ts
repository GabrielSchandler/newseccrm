import { NextResponse } from "next/server";
import {
  clientRestoreConfirmationText,
  clientRestoreStorageColumns,
  clientRestoreTableOrder,
  countClientRestoreRows,
  getRowId,
  getRowString,
  getRowsByTable,
  isBackupRow,
  type BackupRow,
  type ClientRestoreRows,
  type ClientRestoreTable,
} from "@/lib/backups/client-restore";
import {
  backupFormatVersion,
  grsBackupFormat,
} from "@/lib/backups/format";
import { recordAuditLog } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type RestoreClientRequest = {
  confirmation?: string;
  manifest?: {
    backup_format?: string;
    backup_format_version?: number;
    backup_name?: string;
    company_id?: string;
    generated_at?: string;
  };
  client?: {
    id?: string;
    name?: string;
    cpf?: string;
  };
  rows?: ClientRestoreRows;
  uploadedFiles?: Array<{
    bucket?: string;
    originalPath?: string;
    targetPath?: string;
  }>;
};

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

function validateBackupManifest(body: RestoreClientRequest, companyId: string) {
  if (body.confirmation !== clientRestoreConfirmationText) {
    return "Confirmação inválida. Digite exatamente RESTAURAR CLIENTE.";
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

  if (!body.client?.id) {
    return "Cliente do backup não informado.";
  }

  return null;
}

function assertRowsAreObjects(rows: ClientRestoreRows) {
  for (const table of clientRestoreTableOrder) {
    const tableRows = getRowsByTable(rows, table);

    if (!Array.isArray(tableRows) || !tableRows.every(isBackupRow)) {
      throw new Error(`Tabela ${table} possui linhas inválidas.`);
    }
  }
}

function assertCompanyScope(rows: ClientRestoreRows, companyId: string) {
  for (const table of clientRestoreTableOrder) {
    for (const row of getRowsByTable(rows, table)) {
      const rowCompanyId = getRowString(row, "company_id");

      if (rowCompanyId && rowCompanyId !== companyId) {
        throw new Error(`Tabela ${table} possui dados de outra empresa.`);
      }
    }
  }
}

function assertClientScope(rows: ClientRestoreRows, clientId: string) {
  const clientRows = getRowsByTable(rows, "clients");
  const clientIds = new Set(clientRows.map(getRowId).filter(Boolean));

  if (!clientIds.has(clientId)) {
    throw new Error("O pacote não contém o cadastro do cliente selecionado.");
  }

  if (clientIds.size > 1) {
    throw new Error("O pacote contém mais de um cliente.");
  }

  const preSaleIds = new Set(
    getRowsByTable(rows, "pre_sales").map(getRowId).filter(Boolean),
  );
  const timelineIds = new Set(
    getRowsByTable(rows, "client_timeline_events").map(getRowId).filter(Boolean),
  );

  for (const row of getRowsByTable(rows, "pre_sales")) {
    if (getRowString(row, "client_id") !== clientId) {
      throw new Error("O pacote contém pré-venda de outro cliente.");
    }
  }

  for (const table of [
    "pre_sale_client_snapshot",
    "pre_sale_debt_holders",
    "pre_sale_financial_cases",
    "pre_sale_payments",
  ] as const) {
    for (const row of getRowsByTable(rows, table)) {
      if (!preSaleIds.has(getRowString(row, "pre_sale_id"))) {
        throw new Error(`Tabela ${table} contém dados fora das pré-vendas do cliente.`);
      }
    }
  }

  for (const table of [
    "financing_calculations",
    "generated_documents",
    "legal_payments",
    "client_documents",
    "client_timeline_events",
    "client_tracking_updates",
    "email_logs",
  ] as const) {
    for (const row of getRowsByTable(rows, table)) {
      const rowClientId = getRowString(row, "client_id");
      const rowPreSaleId = getRowString(row, "pre_sale_id");

      if (rowClientId && rowClientId !== clientId) {
        throw new Error(`Tabela ${table} contém dados de outro cliente.`);
      }

      if (rowPreSaleId && !preSaleIds.has(rowPreSaleId)) {
        throw new Error(`Tabela ${table} contém pré-venda fora do cliente.`);
      }
    }
  }

  for (const row of getRowsByTable(rows, "legacy_rd_import")) {
    const importedClientId = getRowString(row, "imported_client_id");
    const importedPreSaleId = getRowString(row, "imported_pre_sale_id");

    if (importedClientId && importedClientId !== clientId) {
      throw new Error("Importação RD legada contém outro cliente.");
    }

    if (importedPreSaleId && !preSaleIds.has(importedPreSaleId)) {
      throw new Error("Importação RD legada contém pré-venda fora do cliente.");
    }
  }

  for (const row of getRowsByTable(rows, "rd_crm_activity_import")) {
    const matchedClientId = getRowString(row, "matched_client_id");
    const timelineEventId = getRowString(row, "timeline_event_id");

    if (matchedClientId && matchedClientId !== clientId) {
      throw new Error("Importação RD CRM contém outro cliente.");
    }

    if (timelineEventId && !timelineIds.has(timelineEventId)) {
      throw new Error("Importação RD CRM contém timeline fora do cliente.");
    }
  }
}

function assertStoragePaths(rows: ClientRestoreRows, companyId: string) {
  for (const spec of clientRestoreStorageColumns) {
    for (const row of getRowsByTable(rows, spec.table)) {
      for (const column of spec.columns) {
        const value = getRowString(row, column);

        if (value && !value.startsWith(`restores/${companyId}/`)) {
          throw new Error(
            `Arquivo restaurado em ${spec.table}.${column} esta fora do caminho seguro.`,
          );
        }
      }
    }
  }
}

function assertUploadedStorageFiles(
  rows: ClientRestoreRows,
  uploadedFiles: RestoreClientRequest["uploadedFiles"],
  companyId: string,
) {
  const uploaded = new Set(
    (uploadedFiles ?? []).map((file) => `${file.bucket ?? ""}:${file.targetPath ?? ""}`),
  );

  for (const file of uploadedFiles ?? []) {
    if (!file.bucket || !file.targetPath) {
      throw new Error("Arquivo enviado com dados incompletos.");
    }

    if (!file.targetPath.startsWith(`restores/${companyId}/`)) {
      throw new Error("Arquivo enviado fora do caminho seguro de restauração.");
    }
  }

  for (const spec of clientRestoreStorageColumns) {
    for (const row of getRowsByTable(rows, spec.table)) {
      for (const column of spec.columns) {
        const value = getRowString(row, column);

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

async function upsertTableRows({
  adminClient,
  table,
  rows,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  table: ClientRestoreTable;
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
    const body = (await request.json()) as RestoreClientRequest;
    const manifestError = validateBackupManifest(body, profile.companyId);

    if (manifestError) {
      return jsonError(manifestError);
    }

    const manifest = body.manifest;

    if (!manifest) {
      return jsonError("O arquivo selecionado não está no formato de backup GRS.");
    }

    const rows = body.rows ?? {};
    const clientId = body.client!.id as string;

    assertRowsAreObjects(rows);
    assertCompanyScope(rows, profile.companyId);
    assertClientScope(rows, clientId);
    assertStoragePaths(rows, profile.companyId);
    assertUploadedStorageFiles(rows, body.uploadedFiles, profile.companyId);

    const adminClient = createAdminClient();
    const restoredTables: Record<string, number> = {};

    for (const table of clientRestoreTableOrder) {
      const count = await upsertTableRows({
        adminClient,
        table,
        rows: getRowsByTable(rows, table),
      });

      if (count) {
        restoredTables[table] = count;
      }
    }

    await recordAuditLog({
      supabase: adminClient,
      companyId: profile.companyId,
      userProfileId: profile.id,
      action: "restore_client_backup",
      entityType: "client",
      entityId: clientId,
      entityLabel: body.client?.name ?? clientId,
      details: {
        backup_name: manifest.backup_name ?? null,
        backup_generated_at: manifest.generated_at ?? null,
        restored_tables: restoredTables,
        restored_rows: countClientRestoreRows(rows),
        uploaded_files: body.uploadedFiles?.length ?? 0,
      },
    });

    return NextResponse.json({
      ok: true,
      restoredRows: countClientRestoreRows(rows),
      restoredTables,
      uploadedFiles: body.uploadedFiles?.length ?? 0,
    });
  } catch (restoreError) {
    return jsonError(
      restoreError instanceof Error
        ? restoreError.message
        : "Não foi possível restaurar o cliente.",
      500,
    );
  }
}
