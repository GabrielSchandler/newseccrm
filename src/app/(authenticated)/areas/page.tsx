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
        title="Tela inicial"
        description="Escolha a area que voce quer acessar agora."
      />
      <div className="p-6">
        <section className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {workspaceOptions.map((workspace) => (
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
