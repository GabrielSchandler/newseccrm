import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";
import { createClientAction } from "@/app/(authenticated)/clientes/actions";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { UserProfileOption } from "@/types/pre-sale";

export default async function NovoClientePage() {
  const { role, supabase, companyId } = await getCurrentUserContext();
  const { data: legalConsultantsData } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email, role, business_area, is_active, legal_role")
    .eq("company_id", companyId)
    .eq("business_area", "legal")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  const legalUsers = (legalConsultantsData ?? []) as UserProfileOption[];
  const legalAdmins = legalUsers.filter((user) => user.legal_role === "admin");
  const legalConsultants = legalUsers.filter(
    (user) => user.legal_role === "consultant" || !user.legal_role,
  );

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
            legalAdmins={legalAdmins}
            legalConsultants={legalConsultants}
          />
        </div>
      </div>
    </>
  );
}
