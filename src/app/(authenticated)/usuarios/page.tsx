import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { UserToggleStatusButton } from "@/components/users/user-toggle-status-button";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import type { CompanyUserProfile } from "@/types/user";

type UsuariosPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function canAccessUserManagement(role: string | null) {
  return role === "admin" || role === "manager";
}

function canCreateUsers(role: string | null) {
  return role === "admin";
}

function canEditTarget(actorRole: string | null, targetRole: string | null) {
  if (actorRole === "admin") {
    return true;
  }

  if (actorRole === "manager") {
    return targetRole === "seller";
  }

  return false;
}

function successMessage(success?: string) {
  if (success === "created") {
    return "Usuario criado com sucesso.";
  }

  if (success === "updated") {
    return "Usuario atualizado.";
  }

  return null;
}

function errorMessage(error?: string) {
  if (error === "license_limit") {
    return "Limite de usuarios atingido. Contrate uma licenca adicional.";
  }

  return null;
}

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canAccessUserManagement(role)) {
    redirect("/dashboard");
  }

  const [{ data: companyData, error: companyError }, { data, error }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("user_license_limit")
        .eq("id", companyId)
        .single(),
      supabase
        .from("user_profiles")
        .select(
          "id, auth_user_id, company_id, full_name, email, phone, role, is_active, invited_by, deactivated_at, deactivated_by, created_at, updated_at",
        )
        .eq("company_id", companyId)
        .order("is_active", { ascending: false })
        .order("full_name", { ascending: true, nullsFirst: false }),
    ]);

  const users = (data ?? []) as CompanyUserProfile[];
  const activeUsers = users.filter((user) => user.is_active).length;
  const licenseLimit = Number(companyData?.user_license_limit ?? 0);
  const availableLicenses = Math.max(licenseLimit - activeUsers, 0);
  const createBlocked = !canCreateUsers(role) || activeUsers >= licenseLimit;
  const bannerMessage = successMessage(params.success);
  const pageErrorMessage = errorMessage(params.error);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Gestao dos usuarios da empresa, com controle de licencas e ativacao."
      />
      <div className="space-y-6 p-6">
        {bannerMessage ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {bannerMessage}
          </div>
        ) : null}
        {pageErrorMessage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {pageErrorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Licencas contratadas
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{licenseLimit}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuarios ativos
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeUsers}</p>
            <p className="mt-2 text-sm text-slate-600">
              {activeUsers} de {licenseLimit} usuarios ativos
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Licencas disponiveis
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {availableLicenses}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-950">
              {activeUsers} de {licenseLimit} usuarios ativos
            </p>
            {activeUsers >= licenseLimit ? (
              <p className="text-sm text-amber-800">
                Limite de usuarios atingido. Contrate uma licenca adicional.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                {availableLicenses} licenca(s) disponivel(is) para novos acessos.
              </p>
            )}
          </div>
          {canCreateUsers(role) ? (
            createBlocked ? (
              <span className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
                Novo usuario indisponivel
              </span>
            ) : (
              <Link
                href="/usuarios/novo"
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Novo usuario
              </Link>
            )
          ) : null}
        </div>

        {companyError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {companyError.message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Telefone</th>
                    <th className="px-4 py-3 font-semibold">Cargo</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {displayValue(user.full_name)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(user.email)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(user.phone)}
                      </td>
                      <td className="px-4 py-3">
                        <UserRoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        <UserStatusBadge isActive={user.is_active} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateTime(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canEditTarget(role, user.role) ? (
                            <Link
                              href={`/usuarios/${user.id}/editar`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Editar
                            </Link>
                          ) : (
                            <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
                              Somente leitura
                            </span>
                          )}
                          {canEditTarget(role, user.role) ? (
                            <UserToggleStatusButton
                              userId={user.id}
                              isActive={user.is_active}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        Nenhum usuario encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
