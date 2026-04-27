"use client";

import { FileDown, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSignedCalculationPdfUrlAction,
  generateCalculationPdfAction,
  type CalculationActionState,
} from "@/app/(authenticated)/calculos/actions";

export function CalculationPdfActions({
  calculationId,
  hasPdf,
}: {
  calculationId: string;
  hasPdf: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<CalculationActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setState(null);
    startTransition(async () => {
      const result = await generateCalculationPdfAction(calculationId);
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleDownload() {
    setState(null);
    startTransition(async () => {
      const result = await createSignedCalculationPdfUrlAction(calculationId);
      setState(result);

      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileText className="h-4 w-4" />
          {isPending ? "Gerando..." : "Gerar PDF"}
        </button>
        <button
          type="button"
          disabled={isPending || !hasPdf}
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileDown className="h-4 w-4" />
          {hasPdf ? "Baixar PDF" : "PDF indisponivel"}
        </button>
      </div>
      {state ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
