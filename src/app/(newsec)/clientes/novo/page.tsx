import { ClientForm } from "@/components/clients/client-form";
import { TopBar } from "@/components/newsec/top-bar";
import { createClientAction } from "@/app/(authenticated)/clientes/actions";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { UserProfileOption } from "@/types/pre-sale";

export default async function NovoClientePage() {
  const { role, businessArea, userProfileId, supabase, companyId, activeCompany } =
    await getCurrentUserContext();
  const companyName = activeCompany?.trade_name ?? activeCompany?.legal_name ?? "Empresa";
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
  const defaultCommercialConsultantId =
    role === "seller" &&
    businessArea === "commercial" &&
    commercialConsultants.some((consultant) => consultant.id === userProfileId)
      ? userProfileId
      : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName={companyName} links={[{ href: "/clientes", label: "← Clientes" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 border-b border-[var(--ns-border)] px-6 py-6">
          <p className="text-sm font-medium text-[var(--ns-primary)]">Clientes</p>
          <h1 className="text-2xl font-semibold text-[var(--ns-text)]">Novo cliente</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--ns-text-secondary)]">
            Cadastre os dados basicos do cliente. O vínculo com a empresa vem do usuário autenticado.
          </p>
        </div>
        <div className="p-6">
          <div className="ns-card p-6">
            <ClientForm
              submitLabel="Cadastrar cliente"
              defaultValues={{
                commercial_consultant_user_id: defaultCommercialConsultantId,
              }}
              onSubmitAction={createClientAction}
              canReactivateDeletedClient={role === "admin"}
              commercialConsultants={commercialConsultants}
              legalAdmins={legalAdmins}
              legalConsultants={legalConsultants}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
