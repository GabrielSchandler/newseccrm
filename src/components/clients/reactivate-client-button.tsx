"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import {
  reactivateClientAction,
  type ClientActionState,
} from "@/app/(authenticated)/clientes/actions";

type ReactivateClientButtonProps = {
  clientId: string;
};

export function ReactivateClientButton({ clientId }: ReactivateClientButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleReactivate() {
    setMessage(null);

    startTransition(async () => {
      const result: ClientActionState = await reactivateClientAction(clientId);

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="ns-btn-primary">
        <RotateCcw className="h-4 w-4" />
        Reativar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="ns-card w-full max-w-md p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--ns-text)]">
              Reativar cliente
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ns-text-secondary)]">
              Deseja reativar este cliente?
            </p>
            {message ? (
              <div className="mt-4 rounded-lg border border-[var(--ns-danger)]/30 bg-[var(--ns-danger)]/10 px-3 py-2 text-sm text-[var(--ns-danger)]">
                {message}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setIsOpen(false)} disabled={isPending} className="ns-btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={handleReactivate} disabled={isPending} className="ns-btn-primary">
                {isPending ? "Reativando..." : "Confirmar reativação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
