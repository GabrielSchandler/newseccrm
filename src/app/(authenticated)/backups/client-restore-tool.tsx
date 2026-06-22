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
  clientRestoreConfirmationText,
  clientRestoreDataTables,
  clientRestoreStorageColumns,
  clientRestoreTableOrder,
  countClientRestoreRows,
  getRowId,
  getRowString,
  normalizeCpf,
  normalizeSearch,
  safeBackupPath,
  type BackupRow,
  type ClientRestoreFile,
  type ClientRestoreRows,
  type ClientRestoreTable,
} from "@/lib/backups/client-restore";
import { createClient } from "@/lib/supabase/browser";

type BackupManifest = {
  backup_format?: string;
  backup_format_version?: number;
  backup_name?: string;
  backup_root?: string;
  company_id?: string;
  generated_at?: string;
};

type LoadedBackup = {
  fileName: string;
  manifest: BackupManifest;
  rootPrefix: string;
  zip: JSZip;
  tables: Partial<Record<string, BackupRow[]>>;
};

type ClientOption = {
  id: string;
  name: string;
  cpf: string;
};

type RestorePackage = {
  client: ClientOption;
  rows: ClientRestoreRows;
  files: ClientRestoreFile[];
  missingFiles: ClientRestoreFile[];
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
  zip: LoadedBackup["zip"];
  rootPrefix: string;
  table: string;
}) {
  const path = `${rootPrefix}banco/${table}.json`;
  const file = zip.file(path);

  if (!file) {
    return [];
  }

  const parsed = JSON.parse(await file.async("string")) as {
    rows?: unknown[];
  };

  return (parsed.rows ?? []).filter(
    (row): row is BackupRow =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}

function cloneRows(rows: BackupRow[]) {
  return rows.map((row) => ({ ...row }));
}

function buildTargetPath({
  companyId,
  clientId,
  restoreRunId,
  backupName,
  bucket,
  originalPath,
}: {
  companyId: string;
  clientId: string;
  restoreRunId: string;
  backupName: string;
  bucket: string;
  originalPath: string;
}) {
  return safeBackupPath(
    `restores/${companyId}/${clientId}/${restoreRunId}/${backupName}/${bucket}/${originalPath}`,
  );
}

function buildZipPath({
  rootPrefix,
  bucket,
  originalPath,
}: {
  rootPrefix: string;
  bucket: string;
  originalPath: string;
}) {
  return `${rootPrefix}arquivos/${bucket}/${safeBackupPath(originalPath)}`;
}

function getRows(
  tables: Partial<Record<string, BackupRow[]>>,
  table: string,
) {
  return tables[table] ?? [];
}

function pickClientRows({
  loaded,
  client,
}: {
  loaded: LoadedBackup;
  client: ClientOption;
}) {
  const clientId = client.id;
  const rows: ClientRestoreRows = {
    clients: cloneRows(
      getRows(loaded.tables, "clients").filter((row) => getRowId(row) === clientId),
    ),
  };
  const preSales = cloneRows(
    getRows(loaded.tables, "pre_sales").filter(
      (row) => getRowString(row, "client_id") === clientId,
    ),
  );
  const preSaleIds = new Set(preSales.map(getRowId).filter(Boolean));

  rows.pre_sales = preSales;

  for (const table of [
    "pre_sale_client_snapshot",
    "pre_sale_debt_holders",
    "pre_sale_financial_cases",
    "pre_sale_payments",
  ] as const) {
    rows[table] = cloneRows(
      getRows(loaded.tables, table).filter((row) =>
        preSaleIds.has(getRowString(row, "pre_sale_id")),
      ),
    );
  }

  for (const table of [
    "financing_calculations",
    "generated_documents",
    "client_documents",
    "client_timeline_events",
    "client_tracking_updates",
    "email_logs",
  ] as const) {
    rows[table] = cloneRows(
      getRows(loaded.tables, table).filter((row) => {
        const rowClientId = getRowString(row, "client_id");
        const rowPreSaleId = getRowString(row, "pre_sale_id");

        return rowClientId === clientId || preSaleIds.has(rowPreSaleId);
      }),
    );
  }

  rows.legacy_rd_import = cloneRows(
    getRows(loaded.tables, "legacy_rd_import").filter((row) => {
      const importedClientId = getRowString(row, "imported_client_id");
      const importedPreSaleId = getRowString(row, "imported_pre_sale_id");

      return importedClientId === clientId || preSaleIds.has(importedPreSaleId);
    }),
  );

  const timelineIds = new Set(
    (rows.client_timeline_events ?? []).map(getRowId).filter(Boolean),
  );
  const rdActivityRows = cloneRows(
    getRows(loaded.tables, "rd_crm_activity_import").filter((row) => {
      const matchedClientId = getRowString(row, "matched_client_id");
      const timelineEventId = getRowString(row, "timeline_event_id");

      return matchedClientId === clientId || timelineIds.has(timelineEventId);
    }),
  );
  const rdBatchIds = new Set(
    rdActivityRows.map((row) => getRowString(row, "batch_id")).filter(Boolean),
  );

  rows.rd_crm_activity_import = rdActivityRows;
  rows.rd_crm_activity_import_batches = cloneRows(
    getRows(loaded.tables, "rd_crm_activity_import_batches").filter((row) =>
      rdBatchIds.has(getRowId(row)),
    ),
  );

  const documentTemplateIds = new Set(
    (rows.generated_documents ?? [])
      .map((row) => getRowString(row, "template_id"))
      .filter(Boolean),
  );
  rows.document_templates = cloneRows(
    getRows(loaded.tables, "document_templates").filter((row) =>
      documentTemplateIds.has(getRowId(row)),
    ),
  );

  const emailTemplateIds = new Set(
    (rows.email_logs ?? [])
      .map((row) => getRowString(row, "template_id"))
      .filter(Boolean),
  );
  rows.email_templates = cloneRows(
    getRows(loaded.tables, "email_templates").filter((row) =>
      emailTemplateIds.has(getRowId(row)),
    ),
  );

  const legalStageIds = new Set(
    [
      ...preSales.map((row) => getRowString(row, "legal_stage_id")),
      ...(rows.document_templates ?? []).map((row) =>
        getRowString(row, "legal_stage_id"),
      ),
      ...(rows.email_templates ?? []).map((row) =>
        getRowString(row, "legal_stage_id"),
      ),
    ].filter(Boolean),
  );
  rows.legal_workflow_stages = cloneRows(
    getRows(loaded.tables, "legal_workflow_stages").filter((row) =>
      legalStageIds.has(getRowId(row)),
    ),
  );

  return rows;
}

function collectAndRewriteFiles({
  loaded,
  rows,
  client,
  restoreRunId,
}: {
  loaded: LoadedBackup;
  rows: ClientRestoreRows;
  client: ClientOption;
  restoreRunId: string;
}) {
  const files = new Map<string, ClientRestoreFile>();
  const missingFiles = new Map<string, ClientRestoreFile>();
  const backupName = safeBackupPath(loaded.manifest.backup_name ?? "backup");
  const companyId = String(loaded.manifest.company_id ?? "");

  for (const spec of clientRestoreStorageColumns) {
    const tableRows = rows[spec.table as ClientRestoreTable] ?? [];

    for (const row of tableRows) {
      for (const column of spec.columns) {
        const originalPath = safeBackupPath(getRowString(row, column));

        if (!originalPath) {
          continue;
        }

        const zipPath = buildZipPath({
          rootPrefix: loaded.rootPrefix,
          bucket: spec.bucket,
          originalPath,
        });
        const targetPath = buildTargetPath({
          companyId,
          clientId: client.id,
          restoreRunId,
          backupName,
          bucket: spec.bucket,
          originalPath,
        });
        const key = `${spec.bucket}:${originalPath}`;
        const restoreFile: ClientRestoreFile = {
          bucket: spec.bucket,
          originalPath,
          targetPath,
          zipPath,
          size: 0,
          type: "application/octet-stream",
        };

        if (loaded.zip.file(zipPath)) {
          row[column] = targetPath;
          files.set(key, restoreFile);
        } else {
          row[column] = null;
          missingFiles.set(key, restoreFile);
        }
      }
    }
  }

  return {
    files: Array.from(files.values()),
    missingFiles: Array.from(missingFiles.values()),
  };
}

function buildRestorePackage(
  loaded: LoadedBackup,
  client: ClientOption,
  restoreRunId: string,
) {
  const rows = pickClientRows({ loaded, client });
  const { files, missingFiles } = collectAndRewriteFiles({
    loaded,
    rows,
    client,
    restoreRunId,
  });

  return {
    client,
    rows,
    files,
    missingFiles,
  } satisfies RestorePackage;
}

function getRestoreSummary(rows: ClientRestoreRows) {
  return clientRestoreTableOrder
    .map((table) => ({
      table,
      rows: rows[table]?.length ?? 0,
    }))
    .filter((item) => item.rows > 0);
}

async function getFriendlyError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Nao foi possivel concluir a operacao.";
  } catch {
    return "Nao foi possivel concluir a operacao.";
  }
}

export function ClientRestoreTool() {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("Selecione um backup ZIP para comecar.");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedBackup | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restoreRunId, setRestoreRunId] = useState(() => String(Date.now()));
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<RestoreResult | null>(null);

  const filteredClients = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);
    const cpfSearch = normalizeCpf(search);

    return clients
      .filter((client) => {
        if (!normalizedSearch && !cpfSearch) {
          return true;
        }

        return (
          normalizeSearch(client.name).includes(normalizedSearch) ||
          client.cpf.includes(cpfSearch)
        );
      })
      .slice(0, 50);
  }, [clients, search]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const restorePackage = useMemo(
    () =>
      loaded && selectedClient
        ? buildRestorePackage(loaded, selectedClient, restoreRunId)
        : null,
    [loaded, selectedClient, restoreRunId],
  );
  const restoreSummary = useMemo(
    () => (restorePackage ? getRestoreSummary(restorePackage.rows) : []),
    [restorePackage],
  );
  const canRestore =
    loaded &&
    restorePackage &&
    confirmation === clientRestoreConfirmationText &&
    stage !== "preparing" &&
    stage !== "uploading" &&
    stage !== "restoring";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setError(null);
    setResult(null);
    setLoaded(null);
    setClients([]);
    setSelectedClientId("");
    setConfirmation("");
    setRestoreRunId(String(Date.now()));

    if (!file) {
      setStage("idle");
      setMessage("Selecione um backup ZIP para comecar.");
      return;
    }

    try {
      setStage("reading");
      setMessage("Lendo backup e preparando lista de clientes...");
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

      const rootPrefix = getBackupRoot(manifestPath);
      const tables: Partial<Record<string, BackupRow[]>> = {};

      for (const table of backupRestoreOrder) {
        tables[table] = await readTableRows({
          zip,
          rootPrefix,
          table,
        });
      }

      const loadedClients = getRows(tables, "clients")
        .map((row) => ({
          id: getRowId(row),
          name: getRowString(row, "full_name") || "Cliente sem nome",
          cpf: normalizeCpf(row.cpf),
        }))
        .filter((client) => client.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      setLoaded({
        fileName: file.name,
        manifest,
        rootPrefix,
        zip,
        tables,
      });
      setClients(loadedClients);
      setStage("ready");
      setMessage(
        `${formatNumber(loadedClients.length)} cliente(s) encontrados no backup.`,
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
    if (!loaded || !restorePackage || !selectedClient) {
      setError("Selecione um cliente para restaurar.");
      return;
    }

    setError(null);
    setResult(null);

    try {
      setStage("preparing");
      setMessage("Preparando envio seguro dos arquivos do cliente...");

      const uploadResponse = await fetch("/api/backups/restore-client/uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: restorePackage.files,
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
      const uploadedFiles: ClientRestoreFile[] = [];

      setUploadProgress({
        current: 0,
        total: uploadData.uploads.length,
      });
      setStage("uploading");

      for (const [position, upload] of uploadData.uploads.entries()) {
        const fileRef = restorePackage.files[upload.index];

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
      setMessage("Gravando cadastro, pre-vendas, historico e documentos no CRM...");

      const completeResponse = await fetch("/api/backups/restore-client/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation,
          manifest: loaded.manifest,
          client: selectedClient,
          rows: restorePackage.rows,
          uploadedFiles,
        }),
      });

      if (!completeResponse.ok) {
        throw new Error(await getFriendlyError(completeResponse));
      }

      const completeData = (await completeResponse.json()) as RestoreResult;

      setResult(completeData);
      setStage("done");
      setMessage("Cliente restaurado com sucesso.");
    } catch (restoreError) {
      setStage("error");
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Nao foi possivel restaurar o cliente.",
      );
      setMessage("Falha ao restaurar o cliente.");
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-950">
          Backup ZIP
        </span>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileChange}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-800"
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
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Backup carregado
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {loaded.manifest.backup_name ?? loaded.fileName}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Empresa: {loaded.manifest.company_id ?? "Nao informado"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Gerado em: {loaded.manifest.generated_at ?? "Nao informado"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-950">
                Buscar cliente no backup
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite nome ou CPF"
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <select
              value={selectedClientId}
              onChange={(event) => {
                setSelectedClientId(event.target.value);
                setConfirmation("");
                setResult(null);
                setRestoreRunId(String(Date.now()));
              }}
              className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Selecione um cliente</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.cpf ? `- CPF ${client.cpf}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {restorePackage ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Previa da restauracao
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                {restorePackage.client.name}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {restorePackage.client.cpf
                  ? `CPF ${restorePackage.client.cpf}`
                  : "CPF nao informado"}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatNumber(countClientRestoreRows(restorePackage.rows))} linhas
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Pre-vendas
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(restorePackage.rows.pre_sales?.length ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Historico
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(restorePackage.rows.client_timeline_events?.length ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Acompanhamentos
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(restorePackage.rows.client_tracking_updates?.length ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Arquivos
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(restorePackage.files.length)}
              </p>
            </div>
          </div>

          {restorePackage.missingFiles.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {formatNumber(restorePackage.missingFiles.length)} arquivo(s)
              estavam referenciados no banco, mas nao foram encontrados dentro
              do ZIP. Esses campos serao restaurados vazios para evitar links
              quebrados.
            </div>
          ) : null}

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-950">
              Ver detalhes por tabela
            </summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {restoreSummary.map((item) => (
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
              {!restoreSummary.length ? (
                <p className="text-slate-500">Nenhum dado relacionado encontrado.</p>
              ) : null}
            </div>
          </details>

          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-950">
              Confirmacao obrigatoria
            </p>
            <p className="mt-2 text-sm leading-6 text-red-900">
              Esta acao restaura e sobrescreve os registros deste cliente pelo
              conteudo do backup selecionado. Para continuar, digite{" "}
              <strong>{clientRestoreConfirmationText}</strong>.
            </p>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={clientRestoreConfirmationText}
              className="mt-3 w-full rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <button
            type="button"
            onClick={handleRestore}
            disabled={!canRestore}
            className="mt-4 inline-flex rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Restaurar somente este cliente
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          Cliente restaurado. Linhas restauradas:{" "}
          <strong>{formatNumber(result.restoredRows)}</strong>. Arquivos
          enviados: <strong>{formatNumber(result.uploadedFiles)}</strong>.
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        Tabelas consideradas nesta restauracao:{" "}
        {clientRestoreDataTables.join(", ")}.
      </p>
    </div>
  );
}
