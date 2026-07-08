import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  isModuleEnabled,
  loadCompanyPlatformSettings,
} from "@/lib/company/platform-settings";
import { getSellerHome, workspaceOptions } from "@/lib/workspace";

export default async function AreasPage() {
  const { role, businessArea, isPlatformOwner, activeCompany, companyId, supabase } =
    await getCurrentUserContext();
  const { settings } = await loadCompanyPlatformSettings(supabase, companyId);
  const visibleWorkspaces = workspaceOptions.filter((workspace) => {
    if (workspace.value === "commercial") {
      return isModuleEnabled(settings, "commercial");
    }

    if (workspace.value === "legal") {
      return isModuleEnabled(settings, "legal");
    }

    if (workspace.value === "finance") {
      return (role === "admin" || isPlatformOwner) && isModuleEnabled(settings, "finance");
    }

    return true;
  });

  if (role === "seller") {
    redirect(getSellerHome(businessArea));
  }

  if (isPlatformOwner && !activeCompany) {
    redirect("/empresas");
  }

  const companyName =
    activeCompany?.trade_name?.trim() ||
    activeCompany?.legal_name?.trim() ||
    activeCompany?.id ||
    "Empresa selecionada";

  return (
    <>
      <PageHeader
        title="Tela inicial"
        description="Escolha a area operacional que voce quer acessar nesta empresa."
      />
      <div className="space-y-6 p-6">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-teal-50/60 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Empresa ativa
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {companyName}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                O CRM separa os dados por empresa. Clientes, templates,
                documentos, financeiro, leads e esteiras seguem o contexto da
                empresa selecionada.
              </p>
            </div>
            {isPlatformOwner && activeCompany ? (
              <Link
                href="/empresas"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
              >
                Trocar empresa
              </Link>
            ) : null}
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
            {visibleWorkspaces.map((workspace) => (
              <Link
                key={workspace.value}
                href={`/areas/select?workspace=${workspace.value}`}
                className="group flex min-h-48 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-teal-800 transition group-hover:bg-teal-100">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">
                    {workspace.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {workspace.description}
                  </p>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-800">
                  Acessar area
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
