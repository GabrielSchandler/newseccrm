import { redirect } from "next/navigation";
import { updateCompanyUserAction } from "@/app/(authenticated)/usuarios/actions";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getHomeForRole } from "@/lib/workspace";
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
  const { supabase, companyId, role, businessArea } = await getCurrentUserContext();

  if (role !== "admin" && role !== "manager") {
    redirect(getHomeForRole(role, businessArea));
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
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
          Login do acesso: {user.username ?? "-"}{user.nickname ? ` • Apelido: ${user.nickname}` : ""}
        </div>
        <UserForm
          mode="edit"
          defaultValues={user}
          submitLabel="Salvar usuario"
          onSubmitAction={updateAction}
          canAssignAdmin={role === "admin"}
          canManagePasswords={role === "admin"}
          canViewCurrentPassword={role === "admin" || role === "manager"}
        />
      </div>
    </>
  );
}
