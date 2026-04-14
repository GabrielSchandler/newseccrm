import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue } from "@/lib/clients/formatters";
import type { UserProfileOption } from "@/types/pre-sale";

function formatRole(role: string | null) {
  if (role === "admin") {
    return "Administrador";
  }

  if (role === "manager") {
    return "Gerente";
  }

  if (role === "seller") {
    return "Vendedor";
  }

  return displayValue(role);
}

export default async function UsuariosPage() {
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role")
    .eq("company_id", companyId)
    .order("full_name", { ascending: true, nullsFirst: false });
  const users = (data ?? []) as UserProfileOption[];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Consulta dos usuarios vinculados a empresa autenticada."
      />
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta tela ainda e de consulta. A criacao, convite e bloqueio de usuarios
          devem ser feitos em uma etapa propria para nao interferir no Supabase Auth.
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
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
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {formatRole(user.role)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!users.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
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
