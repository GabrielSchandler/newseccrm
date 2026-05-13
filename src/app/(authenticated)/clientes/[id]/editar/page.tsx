import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { updateClientAction } from "@/app/(authenticated)/clientes/actions";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { clientToFormValues } from "@/lib/clients/schema";
import type { Client } from "@/types/client";
import type { UserProfileOption } from "@/types/pre-sale";

type EditarClientePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarClientePage({ params }: EditarClientePageProps) {
  const { id } = await params;
  const { supabase, companyId } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();
  const client = data as Client | null;

  if (error || !client) {
    notFound();
  }

  const { data: legalConsultantsData } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email, role")
    .eq("company_id", companyId)
    .eq("role", "seller")
    .eq("business_area", "legal")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  const legalConsultants = (legalConsultantsData ?? []) as UserProfileOption[];

  return (
    <>
      <PageHeader
        title="Editar cliente"
        description="Atualize os dados do cliente mantendo o vinculo com a empresa autenticada."
      />
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ClientForm
            submitLabel="Salvar alteracoes"
            defaultValues={clientToFormValues(client)}
            onSubmitAction={updateClientAction.bind(null, client.id)}
            legalConsultants={legalConsultants}
          />
        </div>
      </div>
    </>
  );
}
