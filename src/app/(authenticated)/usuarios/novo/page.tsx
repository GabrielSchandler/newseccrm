import { redirect } from "next/navigation";
import { createCompanyUserAction } from "@/app/(authenticated)/usuarios/actions";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUserContext } from "@/lib/auth/current-user";

export default async function NovoUsuarioPage() {
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (role !== "admin") {
    redirect("/usuarios");
  }

  const [{ data: companyData }, { count }] = await Promise.all([
    supabase
      .from("companies")
      .select("user_license_limit")
      .eq("id", companyId)
      .single(),
    supabase
      .from("user_profiles")
      .select("id", { head: true, count: "exact" })
      .eq("company_id", companyId)
      .eq("is_active", true),
  ]);
  const licenseLimit = Number(companyData?.user_license_limit ?? 0);
  const activeUsers = count ?? 0;

  if (activeUsers >= licenseLimit) {
    redirect("/usuarios?error=license_limit");
  }

  return (
    <>
      <PageHeader
        title="Novo usuario"
        description="Crie um acesso com login proprio para a empresa respeitando o limite de licencas contratado."
      />
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          Licencas em uso: {activeUsers} de {licenseLimit}.
        </div>
        <UserForm
          mode="create"
          submitLabel="Criar usuario"
          onSubmitAction={createCompanyUserAction}
          canAssignAdmin
        />
      </div>
    </>
  );
}
