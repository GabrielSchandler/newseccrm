import { redirect } from "next/navigation";
import { updateCompanyUserAction } from "@/app/(authenticated)/usuarios/actions";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { CompanyUserProfile } from "@/types/user";

type EditarUsuarioPageProps = {
  params: Promise<{ id: string }>;
};

function canEditTarget(actorRole: string | null, targetRole: string | null) {
  if (actorRole === "admin") {
    return true;
  }

  if (actorRole === "manager") {
    return targetRole === "seller";
  }

  return false;
}

export default async function EditarUsuarioPage({
  params,
}: EditarUsuarioPageProps) {
  const { id } = await params;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (role !== "admin" && role !== "manager") {
    redirect(role === "seller" ? "/pre-vendas" : "/dashboard");
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, auth_user_id, company_id, full_name, username, email, phone, role, is_active, invited_by, deactivated_at, deactivated_by, created_at, updated_at",
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  const user = data as CompanyUserProfile | null;

  if (error || !user || !canEditTarget(role, user.role)) {
    redirect("/usuarios");
  }

  const updateAction = updateCompanyUserAction.bind(null, user.id);

  return (
    <>
      <PageHeader
        title="Editar usuario"
        description="Atualize nome, login, telefone, cargo e status do acesso da empresa."
      />
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          Login do acesso: {user.username ?? "-"}
        </div>
        <UserForm
          mode="edit"
          defaultValues={user}
          submitLabel="Salvar usuario"
          onSubmitAction={updateAction}
          canAssignAdmin={role === "admin"}
        />
      </div>
    </>
  );
}
