import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyPlatformSettingsForm } from "@/components/company/company-platform-settings-form";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  companyModuleDefinitions,
  formatBytes,
  formatStorageLimit,
  getCompanyPlatformStatusMeta,
  getStorageUsagePercent,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
import { getHomeForRole } from "@/lib/workspace";
import type { CompanyProfile } from "@/types/company";

type CompanySettingsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type CountResult = {
  count: number | null;
};

type ClientDocumentStorageRow = {
  file_size: number | string | null;
  deleted_at: string | null;
};

type TemplateStorageRow = {
  original_docx_size: number | string | null;
  original_pdf_size: number | string | null;
};

type BackupStorageRow = {
  file_size_bytes: number | string | null;
  storage_bucket: string | null;
};

function companyDisplayName(company: Pick<CompanyProfile, "trade_name" | "legal_name">) {
  return company.trade_name?.trim() || company.legal_name?.trim() || "Empresa sem nome";
}

function readCount(result: CountResult) {
  return Number(result.count ?? 0);
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const meta = getCompanyPlatformStatusMeta(status);
  const className =
    meta.tone === "success"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : meta.tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : meta.tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {meta.label}
    </span>
  );
}

export default async function CompanySettingsPage({
  params,
  searchParams,
}: CompanySettingsPageProps) {
  const [{ id: companyId }, query] = await Promise.all([params, searchParams]);
  const {
    supabase,
    role,
    businessArea,
    isPlatformOwner,
  } = await getCurrentUserContext();

  if (!isPlatformOwner) {
    redirect(getHomeForRole(role, businessArea));
  }

  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, legal_name, trade_name, cnpj, email, phone, website, user_license_limit, created_at, updated_at",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !companyRow) {
    notFound();
  }

  const company = companyRow as CompanyProfile;
  const settingsLoad = await loadCompanyPlatformSettings(supabase, company.id);
  const [
    usersCount,
    activeUsersCount,
    clientsCount,
    preSalesCount,
    approvedPreSalesCount,
    generatedDocumentsCount,
    templatesCount,
    simulationsCount,
    leadSourcesCount,
    backupJobsCount,
    clientDocumentsRows,
    templateStorageRows,
    backupRows,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("is_active", true),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("pre_sales")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("pre_sales")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("status", "aprovado"),
    supabase
      .from("generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("document_templates")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("financing_calculations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("lead_sources")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("backup_jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
    supabase
      .from("client_documents")
      .select("file_size, deleted_at")
      .eq("company_id", company.id),
    supabase
      .from("document_templates")
      .select("original_docx_size, original_pdf_size")
      .eq("company_id", company.id),
    supabase
      .from("backup_jobs")
      .select("file_size_bytes, storage_bucket")
      .eq("company_id", company.id)
      .eq("status", "completed"),
  ]);

  const clientDocuments = (clientDocumentsRows.data ?? []) as ClientDocumentStorageRow[];
  const templateStorage = (templateStorageRows.data ?? []) as TemplateStorageRow[];
  const backups = (backupRows.data ?? []) as BackupStorageRow[];
  const documentsStorageBytes = clientDocuments.reduce(
    (total, document) => total + (document.deleted_at ? 0 : toNumber(document.file_size)),
    0,
  );
  const templatesStorageBytes = templateStorage.reduce(
    (total, template) =>
      total + toNumber(template.original_docx_size) + toNumber(template.original_pdf_size),
    0,
  );
  const backupStorageBytes = backups.reduce(
    (total, backup) =>
      backup.storage_bucket === "github-releases"
        ? total
        : total + toNumber(backup.file_size_bytes),
    0,
  );
  const knownStorageBytes =
    documentsStorageBytes + templatesStorageBytes + backupStorageBytes;
  const storagePercent = getStorageUsagePercent(
    knownStorageBytes,
    settingsLoad.settings.storage_limit_mb,
  );
  const activeModules = companyModuleDefinitions.filter(
    (module) => settingsLoad.settings[module.field] !== false,
  );
  const disabledModules = companyModuleDefinitions.filter(
    (module) => settingsLoad.settings[module.field] === false,
  );
  const licenseLimit = Number(company.user_license_limit ?? 10);
  const usedLicenses = readCount(activeUsersCount);
  const licensePercent = licenseLimit > 0
    ? Math.min(100, Math.round((usedLicenses / licenseLimit) * 100))
    : 0;
  const successMessage =
    query.success === "settings" ? "Configuracoes salvas com sucesso." : null;
  const errorMessage = query.error ? decodeURIComponent(query.error) : settingsLoad.errorMessage;

  return (
    <>
      <PageHeader
        title="Configurar empresa"
        description="Controle plano, modulos, limites e indicadores da empresa selecionada."
      />

      <div className="space-y-6 p-6">
        {successMessage ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Empresa SaaS
                </p>
                <StatusBadge status={settingsLoad.settings.status} />
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {companyDisplayName(company)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {displayValue(company.legal_name)}
              </p>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    CNPJ
                  </dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {displayValue(company.cnpj)}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contato
                  </dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {displayValue(company.email || company.phone)}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criada em
                  </dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {formatDateTime(company.created_at)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Acesso rapido
              </p>
              <Link
                href={`/empresas/select?company=${company.id}`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Entrar nesta empresa
              </Link>
              <Link
                href="/empresas"
                className="inline-flex w-full items-center justify-center rounded-lg border border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
              >
                Voltar ao painel
              </Link>
              <p className="pt-2 text-xs leading-5 text-teal-900">
                O acesso aos dados continua isolado por empresa. Esta tela apenas controla
                liberacoes e limites do ambiente selecionado.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuarios
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {usedLicenses}/{licenseLimit}
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-teal-700"
                style={{ width: `${licensePercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {readCount(usersCount)} usuario(s) cadastrados
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Armazenamento conhecido
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatBytes(knownStorageBytes)}
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-teal-700"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Limite: {formatStorageLimit(settingsLoad.settings.storage_limit_mb)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Operacao
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {readCount(clientsCount)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              clientes, {readCount(preSalesCount)} pre-venda(s)
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Documentos e automacao
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {readCount(generatedDocumentsCount)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {readCount(templatesCount)} template(s), {readCount(simulationsCount)} simulacao(oes)
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Modulos liberados
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Recursos ativos para a empresa
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {activeModules.map((module) => (
                <div key={module.key} className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-teal-950">{module.label}</p>
                      <p className="mt-1 text-sm leading-6 text-teal-900">
                        {module.description}
                      </p>
                    </div>
                    {module.preparedOnly ? (
                      <span className="rounded-full border border-teal-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                        Preparado
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Indicadores
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Pre-vendas aprovadas</dt>
                  <dd className="font-semibold text-slate-950">
                    {readCount(approvedPreSalesCount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Fontes de leads</dt>
                  <dd className="font-semibold text-slate-950">
                    {readCount(leadSourcesCount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Backups registrados</dt>
                  <dd className="font-semibold text-slate-950">
                    {readCount(backupJobsCount)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Desativados
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {disabledModules.length ? (
                  disabledModules.map((module) => (
                    <span
                      key={module.key}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {module.shortLabel}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">Todos os modulos estao liberados.</p>
                )}
              </div>
            </div>
          </aside>
        </section>

        <CompanyPlatformSettingsForm
          companyId={company.id}
          companyName={companyDisplayName(company)}
          settings={settingsLoad.settings}
          licenseLimit={licenseLimit}
          settingsTableReady={settingsLoad.tableReady}
        />
      </div>
    </>
  );
}
