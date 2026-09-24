"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  softDeleteClientAction,
  type ClientActionState,
} from "@/app/(authenticated)/clientes/actions";

type DeleteClientButtonProps = {
  clientId: string;
};

export function DeleteClientButton({ clientId }: DeleteClientButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDelete() {
    setMessage(null);

    startTransition(async () => {
      const result: ClientActionState = await softDeleteClientAction(clientId);

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="ns-btn-danger">
        <Trash2 className="h-4 w-4" />
        Desativar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="ns-card w-full max-w-md p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--ns-text)]">
              Desativar cliente
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ns-text-secondary)]">
              Tem certeza que deseja desativar este cliente?
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
              <button type="button" onClick={handleDelete} disabled={isPending} className="ns-btn-danger-solid">
                {isPending ? "Desativando..." : "Confirmar desativacao"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
