import "server-only";
import {
  backupBucketName,
  buildFullBackupZip,
  getBackupExpirationDate,
  getBackupStoragePath,
  prepareBackupData,
} from "@/lib/backups/export";
import { createAdminClient } from "@/lib/supabase/admin";

type BackupTriggerType = "manual" | "scheduled";

type BackupJobRow = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
};

const staleRunningBackupMinutes = 20;

function isMissingBackupTable(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.toLowerCase().includes("backup_jobs") ||
    false
  );
}

async function cleanupExpiredBackups(adminClient: ReturnType<typeof createAdminClient>) {
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("backup_jobs")
    .select("id, storage_bucket, storage_path")
    .lt("expires_at", now);

  if (isMissingBackupTable(error)) {
    return;
  }

  if (error) {
    throw new Error(`Nao foi possivel limpar backups vencidos: ${error.message}`);
  }

  const rows = (data ?? []) as BackupJobRow[];

  for (const row of rows) {
    if (!row.storage_path) {
      continue;
    }

    await adminClient.storage
      .from(row.storage_bucket ?? backupBucketName)
      .remove([row.storage_path]);
  }

  if (rows.length) {
    await adminClient
      .from("backup_jobs")
      .delete()
      .in(
        "id",
        rows.map((row) => row.id),
      );
  }
}

async function markStaleRunningBackups(adminClient: ReturnType<typeof createAdminClient>) {
  const staleBefore = new Date();
  staleBefore.setMinutes(staleBefore.getMinutes() - staleRunningBackupMinutes);

  const { error } = await adminClient
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

  if (isMissingBackupTable(error)) {
    return;
  }

  if (error) {
    throw new Error(`Nao foi possivel atualizar backups travados: ${error.message}`);
  }
}

export async function generateStoredBackup({
  companyId,
  requestedBy,
  triggerType,
}: {
  companyId: string;
  requestedBy: string | null;
  triggerType: BackupTriggerType;
}) {
  const adminClient = createAdminClient();

  await markStaleRunningBackups(adminClient);
  await cleanupExpiredBackups(adminClient);

  const preparedBackup = await prepareBackupData({
    adminClient,
    companyId,
    generatedBy: requestedBy,
  });
  const storagePath = getBackupStoragePath(companyId, preparedBackup.backup_name);
  const { data: job, error: createError } = await adminClient
    .from("backup_jobs")
    .insert({
      company_id: companyId,
      requested_by: requestedBy,
      trigger_type: triggerType,
      status: "running",
      backup_name: preparedBackup.backup_name,
      storage_bucket: backupBucketName,
      storage_path: storagePath,
      expires_at: getBackupExpirationDate(),
    })
    .select("id")
    .single();

  if (isMissingBackupTable(createError)) {
    throw new Error("Tabela backup_jobs nao encontrada. Rode o SQL docs/sql/backups.sql no Supabase.");
  }

  if (createError || !job) {
    throw new Error(createError?.message ?? "Nao foi possivel criar o registro do backup.");
  }

  try {
    const zip = await buildFullBackupZip({
      adminClient,
      prepared: preparedBackup,
    });
    const { error: uploadError } = await adminClient.storage
      .from(backupBucketName)
      .upload(storagePath, zip.content, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: updateError } = await adminClient
      .from("backup_jobs")
      .update({
        status: "completed",
        file_size_bytes: zip.content.byteLength,
        manifest: zip.manifest,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (job as { id: string }).id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      id: (job as { id: string }).id,
      backup_name: preparedBackup.backup_name,
      storage_path: storagePath,
      file_size_bytes: zip.content.byteLength,
      manifest: zip.manifest,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao gerar backup.";

    await adminClient
      .from("backup_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (job as { id: string }).id);

    throw error;
  }
}

export async function getStoredBackupDownloadUrl({
  bucket,
  path,
}: {
  bucket: string;
  path: string;
}) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export { isMissingBackupTable };
