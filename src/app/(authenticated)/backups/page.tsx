import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getStoredBackupDownloadUrl, isMissingBackupTable } from "@/lib/backups/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHomeForRole } from "@/lib/workspace";
import { BackupGenerator } from "./backup-generator";
import { ClientRestoreTool } from "./client-restore-tool";
import { FullRestoreTool } from "./full-restore-tool";
import { RestoreDiagnostics } from "./restore-diagnostics";

const backupItems = [
  "Dados da empresa, usuários, clientes, pré-vendas e pagamentos.",
  "Templates, documentos gerados, simulações e arquivos anexados aos clientes.",
  "Linha do tempo, acompanhamento do cliente, logs, emails e registros de importação.",
];
const runningTimeoutMinutes = 20;

type BackupJob = {
  id: string;
  backup_name: string;
  trigger_type: "manual" | "scheduled";
  status: "running" | "completed" | "failed";
  storage_bucket: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  expires_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatFileSize(value: number | null) {
  if (!value) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toLocaleString("pt-BR", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  })} ${units[unitIndex]}`;
}

function isStaleRunningJob(job: BackupJob) {
  if (job.status !== "running") {
    return false;
  }

  const startedAt = new Date(job.started_at).getTime();

  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return Date.now() - startedAt > runningTimeoutMinutes * 60 * 1000;
}

function getJobDisplayStatus(job: BackupJob) {
  if (isStaleRunningJob(job)) {
    return "timeout";
  }

  return job.status;
}

export default async function BackupsPage() {
  const { role, businessArea, companyId } = await getCurrentUserContext();

  if (role !== "admin") {
    redirect(getHomeForRole(role, businessArea));
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("backup_jobs")
    .select(
      "id, backup_name, trigger_type, status, storage_bucket, storage_path, file_size_bytes, error_message, started_at, completed_at, expires_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  const jobs = (data ?? []) as BackupJob[];
  const downloadUrls = new Map<string, string>();

  for (const job of jobs) {
    if (job.status !== "completed" || !job.storage_path) {
      continue;
    }

    if (
      job.storage_bucket === "github-releases" &&
      /^https:\/\/github\.com\//.test(job.storage_path)
    ) {
      downloadUrls.set(job.id, job.storage_path);
      continue;
    }

    const url = await getStoredBackupDownloadUrl({
      bucket: job.storage_bucket ?? "backups",
      path: job.storage_path,
    });

    if (url) {
      downloadUrls.set(job.id, url);
    }
  }

  return (
    <>
      <PageHeader
        title="Backups"
        description="Gere, baixe e valide copias padronizadas dos dados e documentos do CRM."
      />

      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Backup automático fora da produção
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Backups privados guardados no GitHub por 7 dias
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                O GitHub Actions gera o backup completo diariamente, pública o
                ZIP em uma Release privada e registra o download nesta página.
                O processo não depende do navegador, do seu computador nem do
                limite de execucao da Vercel.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Para disparar fora do horario automático, acesse o workflow
                Backup CRM no GitHub e use Run workflow.
              </p>

              <a
                href="https://github.com/GabrielSchandler/GRSCRM/actions/workflows/backup.yml"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Abrir rotina de backup no GitHub
              </a>
            </div>

            <div className="rounded-lg border border-teal-100 bg-teal-50 p-5">
              <h3 className="text-sm font-semibold text-teal-950">
                O que entra no backup
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-950">
                {backupItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Histórico
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Backups salvos
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Os arquivos automaticos ficam disponíveis por 7 dias nas
                Releases privadas do GitHub.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {isMissingBackupTable(error)
                ? "A estrutura de backups ainda não existe. Rode o SQL docs/sql/backups.sql no Supabase e recarregue a página."
                : error.message}
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Backup</th>
                      <th className="px-4 py-3 font-semibold">Origem</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Tamanho</th>
                      <th className="px-4 py-3 font-semibold">Gerado em</th>
                      <th className="px-4 py-3 font-semibold">Expira em</th>
                      <th className="px-4 py-3 font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobs.map((job) => {
                      const displayStatus = getJobDisplayStatus(job);

                      return (
                        <tr key={job.id} className="align-top">
                          <td className="px-4 py-3 font-medium text-slate-950">
                            {job.backup_name}
                            {job.error_message ? (
                              <p className="mt-1 max-w-md text-xs font-normal text-red-700">
                                {job.error_message}
                              </p>
                            ) : null}
                            {displayStatus === "timeout" ? (
                              <p className="mt-1 max-w-md text-xs font-normal text-red-700">
                                A geração passou de {runningTimeoutMinutes} minutos e
                                provavelmente foi interrompida pela Vercel.
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {job.trigger_type === "scheduled" ? "Automático" : "Manual"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                displayStatus === "completed"
                                  ? "bg-teal-50 text-teal-800"
                                  : displayStatus === "running"
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-red-50 text-red-800"
                              }`}
                            >
                              {displayStatus === "completed"
                                ? "Concluido"
                                : displayStatus === "running"
                                  ? "Gerando"
                                  : displayStatus === "timeout"
                                    ? "Tempo excedido"
                                    : "Erro"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatFileSize(job.file_size_bytes)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatDateTime(job.completed_at ?? job.started_at)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatDateTime(job.expires_at)}
                          </td>
                          <td className="px-4 py-3">
                            {downloadUrls.has(job.id) ? (
                              <a
                                href={downloadUrls.get(job.id)}
                                target={
                                  job.storage_bucket === "github-releases"
                                    ? "_blank"
                                    : undefined
                                }
                                rel={
                                  job.storage_bucket === "github-releases"
                                    ? "noreferrer"
                                    : undefined
                                }
                                className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                {job.storage_bucket === "github-releases"
                                  ? "Baixar no GitHub"
                                  : "Baixar"}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Indisponível</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!jobs.length ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                          Nenhum backup salvo ainda.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Backup manual completo
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Baixe uma cópia completa com documentos para guardar fora da plataforma
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Esse backup monta o ZIP no seu computador e segue o mesmo
                formato do backup automático. Use quando quiser guardar uma
                cópia local completa antes de uma mudança importante ou para
                sua rotina mensal.
              </p>
              <BackupGenerator />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold text-slate-950">
                Importante
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Se fechar a aba durante essa geração, o processo manual e
                interrompido. Para o backup salvo automaticamente, use a lista
                de backups acima.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Restauração
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Diagnosticar backup antes de restaurar
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Esta primeira ferramenta confere se o ZIP esta no padrão GRS,
                se o manifesto existe, se as tabelas esperadas estao presentes
                e se os arquivos foram embutidos. Ela ainda não altera dados do
                CRM.
              </p>
              <RestoreDiagnostics />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-semibold text-amber-950">
                Modo seguro
              </h3>
              <p className="mt-3 text-sm leading-6 text-amber-900">
                O diagnóstico não altera dados do CRM. A restauração por
                cliente está disponível abaixo; a restauração completa do
                sistema sera feita em uma etapa separada, com relatório de
                impacto próprio.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Restauração por cliente
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Recuperar cadastro, histórico, pré-vendas e arquivos de um cliente
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Use quando precisar recuperar somente um cliente do backup. O
                sistema restaura os dados vinculados a ele e grava os arquivos
                recuperados em um caminho novo de restauração, sem apagar
                documentos atuais do Storage.
              </p>
              <ClientRestoreTool />
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <h3 className="text-sm font-semibold text-red-950">
                Ação sensível
              </h3>
              <p className="mt-3 text-sm leading-6 text-red-900">
                Esta ferramenta faz upsert: se o registro do cliente já existir,
                ele pode ser sobrescrito pelo conteúdo do backup. Por isso ela
                exige seleção do cliente, prévia e confirmação manual.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-red-300 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Restauração completa
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Restaurar todo o sistema a partir de um backup completo
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Use somente em caso de perda grave de dados ou migracao
                controlada. A ferramenta envia os arquivos do ZIP para os
                buckets originais e substitui os dados da empresa atual pelo
                conteúdo do backup.
              </p>
              <FullRestoreTool />
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <h3 className="text-sm font-semibold text-red-950">
                Antes de restaurar
              </h3>
              <p className="mt-3 text-sm leading-6 text-red-900">
                Baixe e guarde um backup atual antes de executar esta ação. A
                restauração completa apaga os dados atuais da empresa nas
                tabelas do CRM e reinsere o conteúdo do ZIP selecionado.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Dados sensíveis
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O ZIP pode conter documentos, dados pessoais, emails e tokens
              criptografados. Guarde somente em uma pasta autorizada.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Arquivo grande
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Se houver muitos documentos, o backup completo pode demorar e
              gerar um ZIP pesado. Aguarde a conclusao antes de fechar a aba.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Conferencia
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dentro do ZIP existe um arquivo manifest.json com a quantidade de
              linhas exportadas e possíveis avisos sobre arquivos não baixados.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
