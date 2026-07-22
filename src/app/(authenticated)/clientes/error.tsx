"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type ClientesErrorPageProps = {
  error: Error;
  reset: () => void;
};

export default function ClientesErrorPage({ error, reset }: ClientesErrorPageProps) {
  const isProfileContextError = error.name === "UserProfileContextError";

  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Não foi possível carregar clientes
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isProfileContextError
                ? error.message
                : "Ocorreu um erro ao carregar o módulo de clientes."}
            </p>
            {isProfileContextError ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Verifique se o usuário autenticado possui um registro vinculado
                em public.user_profiles.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
