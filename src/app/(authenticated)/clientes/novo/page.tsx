import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { createClientAction } from "@/app/(authenticated)/clientes/actions";
import { getCurrentUserContext } from "@/lib/auth/current-user";

export default async function NovoClientePage() {
  const { role } = await getCurrentUserContext();

  return (
    <>
      <PageHeader
        title="Novo cliente"
        description="Cadastre os dados basicos do cliente. O vinculo com a empresa vem do usuario autenticado."
      />
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ClientForm
            submitLabel="Cadastrar cliente"
            onSubmitAction={createClientAction}
            canReactivateDeletedClient={role === "admin"}
          />
        </div>
      </div>
    </>
  );
}
