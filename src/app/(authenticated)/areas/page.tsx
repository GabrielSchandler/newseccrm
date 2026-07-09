import Link from "next/link";
import { redirect } from "next/navigation";
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

  return (
    <>
      <PageHeader
        title="Tela inicial"
        description="Escolha a area que voce quer acessar agora."
      />
      <div className="p-6">
        <section className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {isPlatformOwner && activeCompany ? (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Empresa selecionada</p>
                <p className="mt-1 text-teal-900">
                  {activeCompany.trade_name || activeCompany.legal_name || activeCompany.id}
                </p>
              </div>
              <Link
                href="/empresas"
                className="inline-flex items-center justify-center rounded-lg border border-teal-300 bg-white px-3 py-2 font-semibold text-teal-800 transition hover:bg-teal-100"
              >
                Trocar empresa
              </Link>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleWorkspaces.map((workspace) => (
              <Link
                key={workspace.value}
                href={`/areas/select?workspace=${workspace.value}`}
                className="rounded-lg border border-slate-200 bg-white p-6 text-left transition hover:border-teal-300 hover:bg-teal-50"
              >
                <h2 className="text-lg font-semibold text-slate-950">{workspace.label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {workspace.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
