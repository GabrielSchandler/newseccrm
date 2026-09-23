import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EmpresaSuspensaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Empresa suspensa
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          O acesso da sua empresa está suspenso
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A conta da sua empresa nesta plataforma está suspensa ou cancelada.
          Fale com o administrador responsável pela conta pra regularizar o
          acesso.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
