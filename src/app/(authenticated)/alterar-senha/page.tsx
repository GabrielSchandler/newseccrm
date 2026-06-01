import { RequiredPasswordChangeForm } from "@/components/auth/required-password-change-form";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";

export default async function AlterarSenhaPage() {
  const { fullName, username } = await getCurrentUserContext();

  return (
    <>
      <PageHeader
        title="Alterar senha"
        description="Defina uma senha definitiva para continuar usando o CRM."
      />
      <div className="p-6">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Troca obrigatoria de senha</p>
            <p className="mt-1 leading-6">
              {fullName ?? username ?? "Seu usuario"}, sua senha foi definida
              como provisoria por um administrador. Cadastre uma nova senha para
              liberar o acesso ao sistema.
            </p>
          </div>
          <RequiredPasswordChangeForm />
        </div>
      </div>
    </>
  );
}
