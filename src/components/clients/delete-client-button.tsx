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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-950">
              Excluir cliente
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tem certeza que deseja excluir este cliente?
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
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Excluindo..." : "Confirmar exclusao"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
