"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteFinancingCalculationAction,
  type CalculationActionState,
} from "@/app/(authenticated)/calculos/actions";

type CalculationDeleteButtonProps = {
  calculationId: string;
  variant?: "button" | "inline";
  redirectTo?: string;
};

export function CalculationDeleteButton({
  calculationId,
  variant = "button",
  redirectTo = "/calculos?success=deleted",
}: CalculationDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<CalculationActionState | null>(null);

  function handleDelete() {
    if (!window.confirm("Deseja excluir esta simulacao?")) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteFinancingCalculationAction(calculationId);
      setMessage(result);

      if (result.ok) {
        router.push(result.redirectTo ?? redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className={variant === "inline" ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
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
