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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        <RotateCcw className="h-4 w-4" />
        Reativar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-950">
              Reativar cliente
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Deseja reativar este cliente?
            </p>
            {message ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {message}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={isPending}
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Reativando..." : "Confirmar reativacao"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
