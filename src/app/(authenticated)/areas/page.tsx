import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getSellerHome, workspaceOptions } from "@/lib/workspace";

export default async function AreasPage() {
  const { role, businessArea } = await getCurrentUserContext();

  if (role === "seller") {
    redirect(getSellerHome(businessArea));
  }

  return (
    <>
      <PageHeader
        title="Escolha a area"
        description="Selecione em qual frente voce quer trabalhar agora dentro do CRM."
      />
      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            A area Comercial concentra tudo o que ja construimos. Gestao fica com dashboard,
            usuarios, empresa, logs e configuracoes. Juridico fica preparado para o proximo modulo.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {workspaceOptions.map((workspace) => (
              <Link
                key={workspace.value}
                href={`/areas/select?workspace=${workspace.value}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-200 hover:bg-teal-50"
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
