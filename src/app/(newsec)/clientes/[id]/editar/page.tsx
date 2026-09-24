import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { TopBar } from "@/components/newsec/top-bar";
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
  const { supabase, companyId, activeCompany } = await getCurrentUserContext();
  const companyName = activeCompany?.trade_name ?? activeCompany?.legal_name ?? "Empresa";

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

  const [{ data: commercialConsultantsData }, { data: legalConsultantsData }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, full_name, nickname, username, email, role, business_area, is_active, legal_role")
        .eq("company_id", companyId)
        .eq("business_area", "commercial")
        .eq("role", "seller")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("user_profiles")
        .select("id, full_name, nickname, username, email, role, business_area, is_active, legal_role")
        .eq("company_id", companyId)
        .eq("business_area", "legal")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);
  const commercialConsultants = (commercialConsultantsData ?? []) as UserProfileOption[];
  const legalUsers = (legalConsultantsData ?? []) as UserProfileOption[];
  const legalAdmins = legalUsers.filter((user) => user.legal_role === "admin");
  const legalConsultants = legalUsers.filter(
    (user) => user.legal_role === "consultant" || !user.legal_role,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName={companyName} links={[{ href: "/clientes", label: "← Clientes" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 border-b border-[var(--ns-border)] px-6 py-6">
          <p className="text-sm font-medium text-[var(--ns-primary)]">Clientes</p>
          <h1 className="text-2xl font-semibold text-[var(--ns-text)]">Editar cliente</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--ns-text-secondary)]">
            Atualize os dados do cliente mantendo o vínculo com a empresa autenticada.
          </p>
        </div>
        <div className="p-6">
          <div className="ns-card p-6">
            <ClientForm
              submitLabel="Salvar alterações"
              defaultValues={clientToFormValues(client)}
              onSubmitAction={updateClientAction.bind(null, client.id)}
              commercialConsultants={commercialConsultants}
              legalAdmins={legalAdmins}
              legalConsultants={legalConsultants}
              requireChangeNote
            />
          </div>
        </div>
      </div>
    </div>
  );
}
