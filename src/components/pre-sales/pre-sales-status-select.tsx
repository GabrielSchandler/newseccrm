"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePreSaleStatusAction } from "@/app/(authenticated)/pre-vendas/actions";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import { preSaleStatuses, type PreSaleStatus } from "@/types/pre-sale";

type PreSalesStatusSelectProps = {
  preSaleId: string;
  status: PreSaleStatus;
  disabled?: boolean;
};

export function PreSalesStatusSelect({
  preSaleId,
  status,
  disabled = false,
}: PreSalesStatusSelectProps) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<PreSaleStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmStatusChange(note: string) {
    if (!pendingStatus) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const result = await updatePreSaleStatusAction(preSaleId, pendingStatus, note);

      if (!result.ok) {
        setMessage(result.message);
        setPendingStatus(null);
        return;
      }

      setPendingStatus(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        disabled={disabled || isPending}
        onChange={(event) => setPendingStatus(event.target.value as PreSaleStatus)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {preSaleStatuses.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {isPending ? <p className="text-xs text-slate-500">Atualizando...</p> : null}
      {message ? <p className="text-xs text-red-600">{message}</p> : null}
      <ChangeNoteModal
        isOpen={Boolean(pendingStatus)}
        title="Registrar mudança de status"
        description="Explique o que aconteceu nessa movimentação da pré-venda e por que ela foi para este novo status."
        confirmLabel="Alterar com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStatus(null);
        }}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
