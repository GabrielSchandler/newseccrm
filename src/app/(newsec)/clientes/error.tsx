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
      <div className="ns-card p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--ns-danger)]/10 p-2 text-[var(--ns-danger)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--ns-text)]">
              Não foi possível carregar clientes
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ns-text-secondary)]">
              {isProfileContextError
                ? error.message
                : "Ocorreu um erro ao carregar o módulo de clientes."}
            </p>
            {isProfileContextError ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ns-text-secondary)]">
                Verifique se o usuário autenticado possui um registro vinculado
                em public.user_profiles.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="ns-btn-primary">
            Tentar novamente
          </button>
          <Link href="/atendimento" className="ns-btn-secondary">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
