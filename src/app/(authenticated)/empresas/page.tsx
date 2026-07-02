import Link from "next/link";
import { redirect } from "next/navigation";
import { createPlatformCompanyAction } from "@/app/(authenticated)/empresas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  companyModuleDefinitions,
  defaultCompanyPlatformSettings,
  getCompanyPlatformStatusMeta,
  isCompanyPlatformSettingsMissingError,
  mergeCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
import { getHomeForRole } from "@/lib/workspace";
import type { CompanyPlatformSettings, CompanyProfile } from "@/types/company";
import type { CompanyUserProfile } from "@/types/user";

type EmpresasPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function companyDisplayName(company: Pick<CompanyProfile, "trade_name" | "legal_name">) {
  return company.trade_name?.trim() || company.legal_name?.trim() || "Empresa sem nome";
}

function errorMessage(error?: string) {
  if (!error) {
    return null;
  }

  if (error === "empresa_indisponivel") {
    return "A empresa selecionada nao esta disponivel. Escolha outra empresa para continuar.";
  }

  return decodeURIComponent(error);
}

function settingsForCompany(
  companyId: string,
  settingsMap: Map<string, CompanyPlatformSettings>,
) {
  return settingsMap.get(companyId) ?? defaultCompanyPlatformSettings(companyId);
}

function enabledModulesCount(settings: CompanyPlatformSettings) {
  return companyModuleDefinitions.filter((module) => settings[module.field] !== false).length;
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
    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {meta.label}
    </span>
  );
}

export default async function EmpresasPage({ searchParams }: EmpresasPageProps) {
  const params = await searchParams;
  const {
    supabase,
    role,
    businessArea,
    companyId,
    selectedCompanyId,
    isPlatformOwner,
  } = await getCurrentUserContext();

  if (!isPlatformOwner) {
    redirect(getHomeForRole(role, businessArea));
  }

  const [{ data: companyRows, error: companiesError }, { data: userRows }] =
    await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, legal_name, trade_name, cnpj, email, phone, user_license_limit, created_at, updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id, company_id, is_active"),
    ]);

  const { data: rawSettingsRows, error: settingsError } = await supabase
    .from("company_platform_settings")
    .select("*");
  const settingsTableReady = !isCompanyPlatformSettingsMissingError(settingsError);
  const settingsWarning =
    settingsError && settingsTableReady
      ? `Nao foi possivel carregar configuracoes SaaS: ${settingsError.message}`
      : null;

  const companies = (companyRows ?? []) as CompanyProfile[];
  const settingsRows = settingsTableReady
    ? ((rawSettingsRows ?? []) as CompanyPlatformSettings[])
    : [];
  const settingsMap = new Map(
    settingsRows.map((settings) => [
      settings.company_id,
      mergeCompanyPlatformSettings(settings.company_id, settings),
    ]),
  );
  const usersByCompany = new Map<string, { total: number; active: number }>();

  ((userRows ?? []) as Pick<CompanyUserProfile, "id" | "company_id" | "is_active">[]).forEach(
    (user) => {
      const current = usersByCompany.get(user.company_id) ?? { total: 0, active: 0 };
      current.total += 1;
      current.active += user.is_active ? 1 : 0;
      usersByCompany.set(user.company_id, current);
    },
  );

  const activeCompanyId = selectedCompanyId || companyId;
  const activeUsers = Array.from(usersByCompany.values()).reduce(
    (total, item) => total + item.active,
    0,
  );
  const contractedUsers = companies.reduce(
    (total, company) => total + Number(company.user_license_limit ?? 0),
    0,
  );
  const activeSettingsCount = companies.filter(
    (company) => settingsForCompany(company.id, settingsMap).status === "active",
  ).length;
  const trialSettingsCount = companies.filter(
    (company) => settingsForCompany(company.id, settingsMap).status === "trial",
  ).length;
  const modulesEnabledTotal = companies.reduce(
    (total, company) => total + enabledModulesCount(settingsForCompany(company.id, settingsMap)),
    0,
  );
  const pageError = errorMessage(params.error);

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Central da plataforma: cadastre empresas, selecione o ambiente ativo e controle os modulos contratados por cliente."
      />

      <div className="space-y-6 p-6">
        {pageError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        ) : null}

        {companiesError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {companiesError.message}. Rode o SQL de plataforma multiempresa no Supabase e tente novamente.
          </div>
        ) : null}

        {!settingsTableReady ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            As configuracoes avancadas ainda estao usando o padrao do sistema. Rode o arquivo
            <span className="font-semibold"> docs/sql/company-platform-settings.sql </span>
            no Supabase para ativar plano, modulos e limites por empresa.
          </div>
        ) : null}

        {settingsWarning ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {settingsWarning}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Painel SaaS
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Controle executivo das empresas
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Antes de entrar em gestao, comercial, juridico ou financeiro, o master escolhe a
                empresa e enxerga rapidamente licencas, status e recursos liberados. Isso protege
                dados de cada cliente do CRM e deixa a operacao pronta para escalar.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/areas"
                  className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Entrar na empresa atual
                </Link>
                <a
                  href="#nova-empresa"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Criar nova empresa
                </a>
              </div>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Empresa selecionada
              </p>
              <p className="mt-2 text-xl font-semibold text-teal-950">
                {companyDisplayName(
                  companies.find((company) => company.id === activeCompanyId) ?? {
                    legal_name: null,
                    trade_name: null,
                  },
                )}
              </p>
              <p className="mt-3 text-sm leading-6 text-teal-900">
                Todas as telas abertas depois da selecao usam somente os registros dessa empresa.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Empresas
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{companies.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              {activeSettingsCount} ativa(s), {trialSettingsCount} em teste
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuarios ativos
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeUsers}</p>
            <p className="mt-2 text-sm text-slate-600">
              {contractedUsers || "Sem"} licenca(s) contratada(s)
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Modulos liberados
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{modulesEnabledTotal}</p>
            <p className="mt-2 text-sm text-slate-600">
              Soma dos recursos ativos por empresa
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Governanca
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {settingsTableReady ? "OK" : "SQL"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {settingsTableReady ? "Configuracao por empresa ativa" : "Configuracao pendente"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Ambientes do CRM
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Empresas cadastradas
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure plano, modulos e limites antes de liberar o acesso ao time.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Empresa</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Usuarios</th>
                    <th className="px-5 py-3">Modulos</th>
                    <th className="px-5 py-3">Criada em</th>
                    <th className="px-5 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((company) => {
                    const userSummary = usersByCompany.get(company.id) ?? {
                      total: 0,
                      active: 0,
                    };
                    const isActive = company.id === activeCompanyId;
                    const settings = settingsForCompany(company.id, settingsMap);
                    const enabledModules = companyModuleDefinitions.filter(
                      (module) => settings[module.field] !== false,
                    );
                    const licenseLimit = Number(company.user_license_limit ?? 0);

                    return (
                      <tr key={company.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-950">
                              {companyDisplayName(company)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {displayValue(company.legal_name)}
                            </span>
                            <span className="text-xs text-slate-500">
                              CNPJ: {displayValue(company.cnpj)}
                            </span>
                            {isActive ? (
                              <span className="mt-1 w-fit rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                                Selecionada
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={settings.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <span className="font-semibold text-slate-950">
                            {userSummary.active}
                          </span>{" "}
                          ativo(s)
                          <p className="mt-1 text-xs text-slate-500">
                            {licenseLimit || "Sem limite"} contratado(s)
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {enabledModules.slice(0, 6).map((module) => (
                              <span
                                key={module.key}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                              >
                                {module.shortLabel}
                              </span>
                            ))}
                            {enabledModules.length > 6 ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                                +{enabledModules.length - 6}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatDateTime(company.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/empresas/select?company=${company.id}`}
                              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                            >
                              Acessar
                            </Link>
                            <Link
                              href={`/empresas/${company.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Configurar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!companies.length ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                        Nenhuma empresa encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <form
            id="nova-empresa"
            action={createPlatformCompanyAction}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Nova empresa
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Criar ambiente no CRM
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ao criar, a empresa recebe o conjunto padrao de modulos. Depois voce pode ajustar
              plano, limites e recursos.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Nome fantasia
                <input
                  name="trade_name"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  placeholder="Ex.: Kairos Solucoes"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Razao social
                <input
                  name="legal_name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  placeholder="Opcional"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                CNPJ
                <input
                  name="cnpj"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  placeholder="Opcional"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                E-mail
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  placeholder="Opcional"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Telefone
                <input
                  name="phone"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  placeholder="Opcional"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Criar e acessar empresa
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
