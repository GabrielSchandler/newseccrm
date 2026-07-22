"use client";

import { FileDown, FileText } from "lucide-react";
import { Eye } from "lucide-react";
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

  function openPdfWindow() {
    const nextWindow = window.open("about:blank", "_blank");

    if (!nextWindow) {
      return null;
    }

    nextWindow.document.title = "Preparando PDF";
    nextWindow.document.body.innerHTML =
      '<div style="font-family: Arial, sans-serif; padding: 32px; color: #0f172a;"><h1 style="font-size: 20px; margin: 0 0 8px;">Preparando PDF...</h1><p style="font-size: 14px; margin: 0; color: #475569;">Aguarde enquanto o CRM libera o link seguro do documento.</p></div>';

    return nextWindow;
  }

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
    const pdfWindow = openPdfWindow();

    startTransition(async () => {
      const result = await createSignedCalculationPdfUrlAction(
        calculationId,
        "download",
      );
      setState(result);

      if (result.ok && result.url) {
        if (pdfWindow) {
          pdfWindow.location.href = result.url;
          return;
        }

        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }

      pdfWindow?.close();
    });
  }

  function handleView() {
    setState(null);
    const pdfWindow = openPdfWindow();

    startTransition(async () => {
      const result = await createSignedCalculationPdfUrlAction(
        calculationId,
        "view",
      );
      setState(result);

      if (result.ok && result.url) {
        if (pdfWindow) {
          pdfWindow.location.href = result.url;
          return;
        }

        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }

      pdfWindow?.close();
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
          onClick={handleView}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Eye className="h-4 w-4" />
          {hasPdf ? "Visualizar PDF" : "PDF indisponível"}
        </button>
        <button
          type="button"
          disabled={isPending || !hasPdf}
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileDown className="h-4 w-4" />
          {hasPdf ? "Baixar PDF" : "PDF indisponível"}
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
