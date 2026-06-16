"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import {
  backupFormatVersion,
  backupRestoreOrder,
  grsBackupFormat,
} from "@/lib/backups/format";

type ManifestTable = {
  table: string;
  rows: number;
  error: string | null;
};

type BackupManifest = {
  backup_format?: string;
  backup_format_version?: number;
  generated_at?: string;
  backup_name?: string;
  company_id?: string;
  restore_order?: string[];
  tables?: ManifestTable[];
  storage?: {
    mode?: string;
    requested_files?: number;
    downloaded_files?: number;
    backup_contains_storage_binaries?: boolean;
    errors?: unknown[];
  };
};

type DiagnosticResult = {
  fileName: string;
  backupName: string;
  generatedAt: string;
  isCompatible: boolean;
  tableCount: number;
  totalRows: number;
  embeddedFiles: number;
  requestedFiles: number;
  downloadedFiles: number;
  storageErrors: number;
  missingTables: string[];
  warnings: string[];
};

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

export function RestoreDiagnostics() {
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setResult(null);
    setError(null);

    if (!file) {
      return;
    }

    try {
      setIsReading(true);
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
      const rootPath = manifestPath.replace(/\/?manifest\.json$/, "");
      const rootPrefix = rootPath ? `${rootPath}/` : "";
      const tableRows = manifest.tables ?? [];
      const tableNames = new Set(tableRows.map((table) => table.table));
      const missingTables = backupRestoreOrder.filter(
        (table) =>
          !tableNames.has(table) &&
          !paths.some((path) => path === `${rootPrefix}banco/${table}.json`),
      );
      const embeddedFiles = paths.filter((path) =>
        path.startsWith(`${rootPrefix}arquivos/`),
      ).length;
      const warnings: string[] = [];

      if (manifest.backup_format !== grsBackupFormat) {
        warnings.push("Formato de backup diferente do padrao atual do GRS.");
      }

      if (manifest.backup_format_version !== backupFormatVersion) {
        warnings.push("Versao do backup diferente da versao aceita pelo sistema.");
      }

      if (!manifest.storage?.backup_contains_storage_binaries) {
        warnings.push("O manifesto indica que os arquivos nao estao embutidos no ZIP.");
      }

      if (missingTables.length) {
        warnings.push("Existem tabelas esperadas que nao foram encontradas no backup.");
      }

      const storageErrors = Array.isArray(manifest.storage?.errors)
        ? manifest.storage.errors.length
        : 0;

      if (storageErrors) {
        warnings.push("O manifesto registrou falhas ao baixar alguns arquivos.");
      }

      setResult({
        fileName: file.name,
        backupName: manifest.backup_name ?? "Backup sem nome",
        generatedAt: formatDateTime(manifest.generated_at),
        isCompatible:
          manifest.backup_format === grsBackupFormat &&
          manifest.backup_format_version === backupFormatVersion,
        tableCount: tableRows.length,
        totalRows: tableRows.reduce((sum, table) => sum + (table.rows ?? 0), 0),
        embeddedFiles,
        requestedFiles: manifest.storage?.requested_files ?? 0,
        downloadedFiles: manifest.storage?.downloaded_files ?? embeddedFiles,
        storageErrors,
        missingTables,
        warnings,
      });
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Nao foi possivel ler este arquivo.",
      );
    } finally {
      setIsReading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-950">
          Selecionar backup ZIP
        </span>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileChange}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-800"
        />
      </label>

      {isReading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Analisando estrutura do backup...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {result.backupName}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Arquivo: {result.fileName} | Gerado em: {result.generatedAt}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                result.isCompatible && !result.warnings.length
                  ? "bg-teal-100 text-teal-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {result.isCompatible ? "Padrao GRS" : "Requer atencao"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Tabelas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(result.tableCount)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Linhas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(result.totalRows)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Arquivos no ZIP
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(result.embeddedFiles)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Falhas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(result.storageErrors)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Arquivos solicitados: {formatNumber(result.requestedFiles)} |
            arquivos baixados no backup: {formatNumber(result.downloadedFiles)}
          </p>

          {result.warnings.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                Pontos de atencao
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
              Estrutura validada. Este arquivo esta pronto para a etapa futura
              de restauracao controlada.
            </div>
          )}

          {result.missingTables.length ? (
            <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-semibold text-slate-950">
                Tabelas ausentes
              </summary>
              <p className="mt-2 break-words">
                {result.missingTables.join(", ")}
              </p>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
