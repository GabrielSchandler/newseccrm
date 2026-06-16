"use client";

import type { ChangeEvent } from "react";
import type JSZip from "jszip";
import { useMemo, useState } from "react";
import {
  backupFormatVersion,
  backupRestoreOrder,
  grsBackupFormat,
} from "@/lib/backups/format";
import {
  countFullRestoreRows,
  fullRestoreConfirmationText,
  fullRestoreStorageColumns,
  normalizeBackupRows,
  normalizeStorageInventoryRef,
  type FullRestoreFile,
  type FullRestoreRows,
  type StorageInventoryRef,
} from "@/lib/backups/full-restore";
import {
  safeBackupPath,
  type BackupRow,
} from "@/lib/backups/client-restore";
import { createClient } from "@/lib/supabase/browser";

type BackupManifest = {
  backup_format?: string;
  backup_format_version?: number;
  backup_name?: string;
  backup_root?: string;
  company_id?: string;
  generated_at?: string;
  storage?: {
    requested_files?: number;
    downloaded_files?: number;
    backup_contains_storage_binaries?: boolean;
    errors?: unknown[];
  };
};

type LoadedFullBackup = {
  fileName: string;
  manifest: BackupManifest;
  rootPrefix: string;
  zip: JSZip;
  rows: FullRestoreRows;
  files: FullRestoreFile[];
  missingFiles: FullRestoreFile[];
  storageErrors: number;
};

type RestoreResult = {
  restoredRows: number;
  uploadedFiles: number;
  restoredTables: Record<string, number>;
};

type Stage =
  | "idle"
  | "reading"
  | "ready"
  | "preparing"
  | "uploading"
  | "restoring"
  | "done"
  | "error";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function findManifestPath(paths: string[]) {
  return (
    paths.find((path) => path.endsWith("/manifest.json")) ??
    paths.find((path) => path === "manifest.json") ??
    null
  );
}

function getBackupRoot(manifestPath: string) {
  const root = manifestPath.replace(/\/?manifest\.json$/, "");
  return root ? `${root}/` : "";
}

async function readTableRows({
  zip,
  rootPrefix,
  table,
}: {
  zip: JSZip;
  rootPrefix: string;
  table: string;
}) {
  const path = `${rootPrefix}banco/${table}.json`;
  const file = zip.file(path);

  if (!file) {
    return [];
  }

  const parsed = JSON.parse(await file.async("string")) as {
    rows?: unknown;
  };

  return normalizeBackupRows(parsed.rows);
}

async function readStorageInventory({
  zip,
  rootPrefix,
}: {
  zip: JSZip;
  rootPrefix: string;
}) {
  const file = zip.file(`${rootPrefix}storage-files.json`);

  if (!file) {
    return [];
  }

  const parsed = JSON.parse(await file.async("string")) as unknown;

  return Array.isArray(parsed) ? (parsed as StorageInventoryRef[]) : [];
}

function cloneRows(rows: BackupRow[]) {
  return rows.map((row) => ({ ...row }));
}

function getRowString(row: BackupRow, field: string) {
  const value = row[field];
  return typeof value === "string" ? value : "";
}

function collectRefsFromRows(rows: FullRestoreRows) {
  const refs: StorageInventoryRef[] = [];

  for (const spec of fullRestoreStorageColumns) {
    const tableRows = rows[spec.table] ?? [];

    for (const row of tableRows) {
      for (const column of spec.columns) {
        const path = getRowString(row, column);

        if (path) {
          refs.push({
            bucket: spec.bucket,
            path,
            source: `${spec.table}.${column}`,
          });
        }
      }
    }
  }

  return refs;
}

function buildZipPath({
  rootPrefix,
  bucket,
  path,
}: {
  rootPrefix: string;
  bucket: string;
  path: string;
}) {
  return `${rootPrefix}arquivos/${bucket}/${safeBackupPath(path)}`;
}

function buildRestoreFiles({
  zip,
  rootPrefix,
  refs,
}: {
  zip: JSZip;
  rootPrefix: string;
  refs: StorageInventoryRef[];
}) {
  const files = new Map<string, FullRestoreFile>();
  const missingFiles = new Map<string, FullRestoreFile>();

  for (const ref of refs) {
    const normalized = normalizeStorageInventoryRef(ref);

    if (!normalized) {
      continue;
    }

    const zipPath = buildZipPath({
      rootPrefix,
      bucket: normalized.bucket,
      path: normalized.path,
    });
    const fileRef: FullRestoreFile = {
      bucket: normalized.bucket,
      originalPath: normalized.path,
      targetPath: normalized.path,
      zipPath,
      size: 0,
      type: "application/octet-stream",
    };
    const key = `${normalized.bucket}:${normalized.path}`;

    if (zip.file(zipPath)) {
      files.set(key, fileRef);
    } else {
      missingFiles.set(key, fileRef);
    }
  }

  return {
    files: Array.from(files.values()),
    missingFiles: Array.from(missingFiles.values()),
  };
}

async function getFriendlyError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Nao foi possivel concluir a operacao.";
  } catch {
    return "Nao foi possivel concluir a operacao.";
  }
}

export function FullRestoreTool() {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("Selecione um backup ZIP completo.");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedFullBackup | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<RestoreResult | null>(null);

  const tableSummary = useMemo(() => {
    if (!loaded) {
      return [];
    }

    return backupRestoreOrder.map((table) => ({
      table,
      rows: loaded.rows[table]?.length ?? 0,
    }));
  }, [loaded]);

  const canRestore =
    loaded &&
    loaded.missingFiles.length === 0 &&
    loaded.storageErrors === 0 &&
    confirmation === fullRestoreConfirmationText &&
    stage !== "preparing" &&
    stage !== "uploading" &&
    stage !== "restoring";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setError(null);
    setResult(null);
    setLoaded(null);
    setConfirmation("");
    setUploadProgress({ current: 0, total: 0 });

    if (!file) {
      setStage("idle");
      setMessage("Selecione um backup ZIP completo.");
      return;
    }

    try {
      setStage("reading");
      setMessage("Lendo backup completo e conferindo arquivos...");
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      const paths = Object.keys(zip.files);
      const manifestPath = findManifestPath(paths);

      if (!manifestPath) {
        throw new Error("Este ZIP nao possui manifest.json.");
      }

      const manifest = JSON.parse(
        await zip.file(manifestPath)!.async("string"),
      ) as BackupManifest;

      if (
        manifest.backup_format !== grsBackupFormat ||
        manifest.backup_format_version !== backupFormatVersion
      ) {
        throw new Error("Este backup nao esta no padrao GRS atual.");
      }

      if (!manifest.storage?.backup_contains_storage_binaries) {
        throw new Error("Este backup nao contem os arquivos do Storage embutidos.");
      }

      const rootPrefix = getBackupRoot(manifestPath);
      const rows: FullRestoreRows = {};

      for (const table of backupRestoreOrder) {
        rows[table] = cloneRows(
          await readTableRows({
            zip,
            rootPrefix,
            table,
          }),
        );
      }

      const inventory = await readStorageInventory({ zip, rootPrefix });
      const refs = inventory.length ? inventory : collectRefsFromRows(rows);
      const { files, missingFiles } = buildRestoreFiles({
        zip,
        rootPrefix,
        refs,
      });
      const storageErrors = Array.isArray(manifest.storage?.errors)
        ? manifest.storage.errors.length
        : 0;

      setLoaded({
        fileName: file.name,
        manifest,
        rootPrefix,
        zip,
        rows,
        files,
        missingFiles,
        storageErrors,
      });
      setStage("ready");
      setMessage(
        `${formatNumber(countFullRestoreRows(rows))} linha(s) e ${formatNumber(files.length)} arquivo(s) prontos para restauracao.`,
      );
    } catch (readError) {
      setStage("error");
      setError(
        readError instanceof Error
          ? readError.message
          : "Nao foi possivel ler o backup.",
      );
      setMessage("Falha ao analisar o backup.");
    }
  }

  async function handleRestore() {
    if (!loaded) {
      setError("Selecione um backup antes de restaurar.");
      return;
    }

    setError(null);
    setResult(null);

    try {
      setStage("preparing");
      setMessage("Preparando envio dos arquivos para os buckets originais...");

      const uploadResponse = await fetch("/api/backups/restore-full/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: loaded.files,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(await getFriendlyError(uploadResponse));
      }

      const uploadData = (await uploadResponse.json()) as {
        uploads: Array<{
          index: number;
          bucket: string;
          path: string;
          token: string;
        }>;
      };
      const supabase = createClient();
      const uploadedFiles: FullRestoreFile[] = [];

      setStage("uploading");
      setUploadProgress({
        current: 0,
        total: uploadData.uploads.length,
      });

      for (const [position, upload] of uploadData.uploads.entries()) {
        const fileRef = loaded.files[upload.index];

        if (!fileRef) {
          throw new Error("Referencia de arquivo restaurado nao encontrada.");
        }

        const zipFile = loaded.zip.file(fileRef.zipPath);

        if (!zipFile) {
          throw new Error(`Arquivo ausente no ZIP: ${fileRef.originalPath}`);
        }

        setMessage(
          `Enviando arquivo ${formatNumber(position + 1)} de ${formatNumber(uploadData.uploads.length)}...`,
        );

        const blob = await zipFile.async("blob");
        const { error: uploadError } = await supabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.path, upload.token, blob, {
            contentType: blob.type || "application/octet-stream",
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        uploadedFiles.push(fileRef);
        setUploadProgress({
          current: position + 1,
          total: uploadData.uploads.length,
        });
      }

      setStage("restoring");
      setMessage("Substituindo os dados da empresa pelo conteudo do backup...");

      const completeResponse = await fetch("/api/backups/restore-full/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation,
          manifest: loaded.manifest,
          rows: loaded.rows,
          uploadedFiles,
        }),
      });

      if (!completeResponse.ok) {
        throw new Error(await getFriendlyError(completeResponse));
      }

      const completeData = (await completeResponse.json()) as RestoreResult;

      setResult(completeData);
      setStage("done");
      setMessage("Sistema restaurado com sucesso a partir do backup.");
    } catch (restoreError) {
      setStage("error");
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Nao foi possivel restaurar o sistema.",
      );
      setMessage("Falha ao restaurar o sistema.");
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-950">
          Backup ZIP completo
        </span>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileChange}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-red-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-red-800"
        />
      </label>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          stage === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : stage === "done"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-slate-200 bg-slate-50 text-slate-700"
        }`}
      >
        {message}
        {stage === "uploading" && uploadProgress.total ? (
          <span className="ml-2 font-semibold">
            {formatNumber(uploadProgress.current)} / {formatNumber(uploadProgress.total)}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loaded ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Previa da restauracao completa
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                {loaded.manifest.backup_name ?? loaded.fileName}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Gerado em {formatDateTime(loaded.manifest.generated_at)}
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
              Acao irreversivel sem outro backup
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Tabelas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(backupRestoreOrder.length)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Linhas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(countFullRestoreRows(loaded.rows))}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Arquivos
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(loaded.files.length)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Falhas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(loaded.missingFiles.length + loaded.storageErrors)}
              </p>
            </div>
          </div>

          {loaded.storageErrors ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              O manifesto registra {formatNumber(loaded.storageErrors)} erro(s)
              de arquivo. A restauracao completa fica bloqueada para evitar
              perda de documentos.
            </div>
          ) : null}

          {loaded.missingFiles.length ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {formatNumber(loaded.missingFiles.length)} arquivo(s)
              referenciados nao foram encontrados dentro do ZIP. Gere um novo
              backup completo antes de restaurar tudo.
            </div>
          ) : null}

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-950">
              Ver linhas por tabela
            </summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {tableSummary.map((item) => (
                <div
                  key={item.table}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                >
                  <span className="text-slate-600">{item.table}</span>
                  <span className="font-semibold text-slate-950">
                    {formatNumber(item.rows)}
                  </span>
                </div>
              ))}
            </div>
          </details>

          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-950">
              Confirmacao obrigatoria
            </p>
            <p className="mt-2 text-sm leading-6 text-red-900">
              Esta acao substitui os dados da empresa atual pelo conteudo do
              backup selecionado. Para continuar, digite{" "}
              <strong>{fullRestoreConfirmationText}</strong>.
            </p>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={fullRestoreConfirmationText}
              className="mt-3 w-full rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <button
            type="button"
            onClick={handleRestore}
            disabled={!canRestore}
            className="mt-4 inline-flex rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Restaurar sistema completo
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          Sistema restaurado. Linhas restauradas:{" "}
          <strong>{formatNumber(result.restoredRows)}</strong>. Arquivos
          enviados: <strong>{formatNumber(result.uploadedFiles)}</strong>.
        </div>
      ) : null}
    </div>
  );
}
