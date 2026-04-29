"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePreSaleAction, type PreSaleActionState } from "@/app/(authenticated)/pre-vendas/actions";

type PreSaleDeleteButtonProps = {
  preSaleId: string;
  variant?: "button" | "inline";
  className?: string;
};

export function PreSaleDeleteButton({
  preSaleId,
  variant = "button",
  className = "",
}: PreSaleDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<PreSaleActionState | null>(null);

  function handleDelete() {
    if (!window.confirm("Deseja excluir esta pre-venda?")) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deletePreSaleAction(preSaleId);
      setMessage(result);

      if (result.ok) {
        router.push("/pre-vendas?success=deleted");
        router.refresh();
      }
    });
  }

  return (
    <div className={variant === "inline" ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        disabled={isPending}
        className={`inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 ${className}`.trim()}
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>
      {message ? (
        <p className={`text-xs ${message.ok ? "text-teal-700" : "text-red-700"}`}>
          {message.message}
        </p>
      ) : null}
    </div>
  );
}
