"use client";

import { useMemo, useState } from "react";
import {
  backupFormatVersion,
  backupRetentionDays,
  backupRestoreOrder,
  grsBackupFormat,
} from "@/lib/backups/format";

type BackupTable = {
  table: string;
  rows: unknown[];
  error: string | null;
};

type BackupFile = {
  bucket: string;
  path: string;
  source: string;
  zip_path: string;
  signed_url: string | null;
  error: string | null;
};

type BackupPayload = {
  generated_at: string;
  backup_name: string;
  backup_root: string;
  company_id: string;
  generated_by: string;
  signed_url_expires_in_seconds: number;
  tables: BackupTable[];
  files: BackupFile[];
};

type DownloadError = {
  bucket: string;
  path: string;
  source: string;
  error: string;
};

type BackupStage = "idle" | "preparing" | "downloading" | "compressing" | "done" | "error";

type BackupState = {
  stage: BackupStage;
  message: string;
  currentFile: number;
  totalFiles: number;
  downloadedFiles: number;
  failedFiles: number;
  compressedPercent: number;
  backupName: string | null;
};

const initialState: BackupState = {
  stage: "idle",
  message: "Pronto para gerar um novo backup.",
  currentFile: 0,
  totalFiles: 0,
  downloadedFiles: 0,
  failedFiles: 0,
  compressedPercent: 0,
  backupName: null,
};
const fileDownloadAttempts = 5;
const retryBaseDelayMs = 1500;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Não foi possível preparar o backup.";
  } catch {
    return "Não foi possível preparar o backup.";
  }
}

function wait(delayMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

async function downloadFileWithRetry(url: string) {
  let lastError = "Não foi possível baixar o arquivo.";

  for (let attempt = 1; attempt <= fileDownloadAttempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;

      if (attempt < fileDownloadAttempts) {
        await wait(retryBaseDelayMs * attempt);
      }
    }
  }

  throw new Error(lastError);
}

export function BackupGenerator() {
  const [state, setState] = useState<BackupState>(initialState);
  const isRunning =
    state.stage === "preparing" ||
    state.stage === "downloading" ||
    state.stage === "compressing";

  const progressPercent = useMemo(() => {
    if (state.stage === "compressing") {
      return Math.max(1, Math.round(state.compressedPercent));
    }

    if (!state.totalFiles) {
      return state.stage === "preparing" ? 8 : state.stage === "done" ? 100 : 0;
    }

    const fileProgress = Math.round((state.currentFile / state.totalFiles) * 80);

    return Math.min(90, Math.max(8, fileProgress + 8));
  }, [state.compressedPercent, state.currentFile, state.stage, state.totalFiles]);

  async function handleGenerateBackup() {
    try {
      setState({
        ...initialState,
        stage: "preparing",
        message: "Preparando dados do CRM e links temporarios dos arquivos...",
      });

      const response = await fetch("/api/backups/manual", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const payload = (await response.json()) as BackupPayload;
      const tableErrors = payload.tables.filter((table) => table.error);

      if (tableErrors.length) {
        throw new Error(
          `Backup interrompido: ${formatNumber(tableErrors.length)} tabela(s) apresentaram erro. Nenhum ZIP incompleto foi gerado.`,
        );
      }

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const downloadableFiles = payload.files.filter((file) => file.signed_url && !file.error);
      const downloadErrors: DownloadError[] = payload.files
        .filter((file) => file.error || !file.signed_url)
        .map((file) => ({
          bucket: file.bucket,
          path: file.path,
          source: file.source,
          error: file.error ?? "Link temporário não foi gerado.",
        }));
      let downloadedFiles = 0;

      for (const table of payload.tables) {
        zip.file(
          `${payload.backup_root}/banco/${table.table}.json`,
          JSON.stringify(
            {
              table: table.table,
              exported_at: payload.generated_at,
              error: table.error,
              rows: table.rows,
            },
            null,
            2,
          ),
        );
      }
      zip.file(
        `${payload.backup_root}/storage-files.json`,
        JSON.stringify(
          payload.files.map((file) => ({
            bucket: file.bucket,
            path: file.path,
            source: file.source,
          })),
          null,
          2,
        ),
      );

      setState({
        stage: "downloading",
        message: "Baixando documentos para montar o ZIP no seu computador...",
        currentFile: 0,
        totalFiles: downloadableFiles.length,
        downloadedFiles: 0,
        failedFiles: downloadErrors.length,
        compressedPercent: 0,
        backupName: payload.backup_name,
      });

      for (const [index, file] of downloadableFiles.entries()) {
        setState((current) => ({
          ...current,
          currentFile: index + 1,
          message: `Baixando arquivo ${formatNumber(index + 1)} de ${formatNumber(downloadableFiles.length)}...`,
        }));

        try {
          const blob = await downloadFileWithRetry(file.signed_url as string);
          zip.file(file.zip_path, blob);
          downloadedFiles += 1;

          setState((current) => ({
            ...current,
            downloadedFiles,
          }));
        } catch (error) {
          downloadErrors.push({
            bucket: file.bucket,
            path: file.path,
            source: file.source,
            error: error instanceof Error ? error.message : "Erro desconhecido.",
          });
          setState((current) => ({
            ...current,
            failedFiles: downloadErrors.length,
          }));
        }
      }

      if (downloadErrors.length) {
        throw new Error(
          `Backup interrompido: ${formatNumber(downloadErrors.length)} arquivo(s) não puderam ser baixados após ${fileDownloadAttempts} tentativas. Nenhum ZIP incompleto foi gerado.`,
        );
      }

      setState((current) => ({
        ...current,
        stage: "compressing",
        message: "Compactando o arquivo final...",
        compressedPercent: 1,
      }));

      zip.file(
        `${payload.backup_root}/manifest.json`,
        JSON.stringify(
          {
            backup_format: grsBackupFormat,
            backup_format_version: backupFormatVersion,
            generated_at: payload.generated_at,
            backup_name: payload.backup_name,
            backup_root: payload.backup_root,
            company_id: payload.company_id,
            generated_by: payload.generated_by,
            signed_url_expires_in_seconds: payload.signed_url_expires_in_seconds,
            retention_days: backupRetentionDays,
            restore_order: backupRestoreOrder,
            tables: payload.tables.map((table) => ({
              table: table.table,
              rows: table.rows.length,
              error: table.error,
            })),
            storage: {
              mode: "embedded_binaries",
              requested_files: payload.files.length,
              downloadable_files: downloadableFiles.length,
              downloaded_files: downloadedFiles,
              backup_contains_storage_inventory: true,
              backup_contains_storage_binaries: true,
              errors: downloadErrors,
            },
          },
          null,
          2,
        ),
      );

      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        },
        (metadata) => {
          setState((current) => ({
            ...current,
            compressedPercent: metadata.percent,
          }));
        },
      );

      triggerDownload(zipBlob, `${payload.backup_name}.zip`);

      setState({
        stage: "done",
        message: "Backup gerado. O download do ZIP foi iniciado.",
        currentFile: downloadableFiles.length,
        totalFiles: downloadableFiles.length,
        downloadedFiles,
        failedFiles: downloadErrors.length,
        compressedPercent: 100,
        backupName: payload.backup_name,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        stage: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o backup.",
      }));
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateBackup}
          disabled={isRunning}
          className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isRunning ? "Gerando backup..." : "Gerar e baixar backup agora"}
        </button>
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          Acesso restrito a administradores
        </span>
      </div>

      <div
        className={`rounded-lg border px-4 py-4 ${
          state.stage === "error"
            ? "border-red-200 bg-red-50"
            : state.stage === "done"
              ? "border-teal-200 bg-teal-50"
              : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {state.backupName ?? "Backup do CRM"}
            </p>
            <p className="mt-1 text-sm text-slate-600">{state.message}</p>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {progressPercent}%
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-teal-700 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
          <span>
            Arquivos baixados: {formatNumber(state.downloadedFiles)}
            {state.totalFiles ? ` de ${formatNumber(state.totalFiles)}` : ""}
          </span>
          <span>Falhas registradas: {formatNumber(state.failedFiles)}</span>
          <span>
            Etapa:{" "}
            {state.stage === "idle"
              ? "aguardando"
              : state.stage === "preparing"
                ? "preparando"
                : state.stage === "downloading"
                  ? "baixando arquivos"
                  : state.stage === "compressing"
                    ? "compactando"
                    : state.stage === "done"
                      ? "concluido"
                      : "erro"}
          </span>
        </div>
      </div>
    </div>
  );
}
