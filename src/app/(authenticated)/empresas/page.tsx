import Link from "next/link";
import { redirect } from "next/navigation";
import { createPlatformCompanyAction } from "@/app/(authenticated)/empresas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { getHomeForRole } from "@/lib/workspace";
import type { CompanyProfile } from "@/types/company";
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
      supabase
        .from("user_profiles")
        .select("id, company_id, is_active"),
    ]);

  const companies = (companyRows ?? []) as CompanyProfile[];
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
  const activeCompanies = companies.length;
  const totalUsers = Array.from(usersByCompany.values()).reduce(
    (total, item) => total + item.total,
    0,
  );
  const activeUsers = Array.from(usersByCompany.values()).reduce(
    (total, item) => total + item.active,
    0,
  );
  const pageError = errorMessage(params.error);

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Selecione a empresa que voce quer administrar antes de acessar gestao, comercial, juridico ou financeiro."
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Empresas cadastradas
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeCompanies}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuarios ativos
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeUsers}</p>
            <p className="mt-2 text-sm text-slate-600">{totalUsers} usuario(s) no total</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Empresa atual
            </p>
            <p className="mt-2 text-lg font-semibold text-teal-950">
              {companyDisplayName(
                companies.find((company) => company.id === activeCompanyId) ?? {
                  legal_name: null,
                  trade_name: null,
                },
              )}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Painel da plataforma
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Empresas do CRM
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Ao acessar uma empresa, todas as telas passam a trabalhar dentro dos registros dela.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Empresa</th>
                    <th className="px-5 py-3">CNPJ</th>
                    <th className="px-5 py-3">Usuarios</th>
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
                            {isActive ? (
                              <span className="mt-1 w-fit rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                                Empresa selecionada
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {displayValue(company.cnpj)}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {userSummary.active} ativo(s) de {userSummary.total}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {formatDateTime(company.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/empresas/select?company=${company.id}`}
                            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                          >
                            Acessar empresa
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {!companies.length ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                        Nenhuma empresa encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <form
            action={createPlatformCompanyAction}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Nova empresa
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Criar empresa no CRM
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Depois de criar, voce sera levado para a tela inicial dessa empresa.
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
