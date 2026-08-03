"use client";

import {
  Download,
  Eye,
  FileImage,
  FileText,
  RefreshCw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSignedCalculationPdfUrlAction,
  createSignedCalculationSummaryImageUrlAction,
  generateCalculationPdfAction,
  type CalculationActionState,
} from "@/app/(authenticated)/calculos/actions";
import {
  sendCalculationAnalysisViaTotalkAction,
  type TotalkSendAnalysisActionState,
} from "@/app/(authenticated)/calculos/totalk-actions";

type ActionKey =
  | "generate"
  | "pdf-view"
  | "pdf-download"
  | "image-view"
  | "image-download"
  | "send";

type CalculationPdfActionsProps = {
  calculationId: string;
  hasPdf: boolean;
  variant?: "full" | "compact";
};

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55";

export function CalculationPdfActions({
  calculationId,
  hasPdf,
  variant = "full",
}: CalculationPdfActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<
    CalculationActionState | TotalkSendAnalysisActionState | null
  >(null);
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function openArtifactWindow(label: string) {
    const nextWindow = window.open("about:blank", "_blank");

    if (!nextWindow) {
      return null;
    }

    nextWindow.document.title = `Preparando ${label}`;
    nextWindow.document.body.innerHTML =
      `<div style="font-family: Arial, sans-serif; padding: 32px; color: #0f172a;"><h1 style="font-size: 20px; margin: 0 0 8px;">Preparando ${label}...</h1><p style="font-size: 14px; margin: 0; color: #475569;">Aguarde enquanto o CRM libera o link seguro.</p></div>`;

    return nextWindow;
  }

  function handleGenerate() {
    setState(null);
    setActiveAction("generate");
    startTransition(async () => {
      const result = await generateCalculationPdfAction(calculationId);
      setState(result);
      setActiveAction(null);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleArtifact(
    actionKey: ActionKey,
    label: string,
    action: () => Promise<CalculationActionState>,
  ) {
    setState(null);
    setActiveAction(actionKey);
    const artifactWindow = openArtifactWindow(label);

    startTransition(async () => {
      const result = await action();
      setState(result);
      setActiveAction(null);

      if (result.ok && result.url) {
        if (artifactWindow) {
          artifactWindow.location.href = result.url;
          return;
        }

        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }

      artifactWindow?.close();
    });
  }

  function handleSendAnalysis() {
    setState(null);
    setActiveAction("send");
    startTransition(async () => {
      const result = await sendCalculationAnalysisViaTotalkAction(calculationId);
      setState(result);
      setActiveAction(null);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleGenerate}
            className={secondaryButtonClass}
          >
            <RefreshCw className="h-4 w-4" />
            {activeAction === "generate" ? "Gerando..." : "Gerar arquivos"}
          </button>
          <button
            type="button"
            disabled={isPending || !hasPdf}
            onClick={() =>
              handleArtifact("pdf-download", "PDF", () =>
                createSignedCalculationPdfUrlAction(calculationId, "download"),
              )
            }
            className={secondaryButtonClass}
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            disabled={isPending || !hasPdf}
            onClick={() =>
              handleArtifact("image-download", "imagem", () =>
                createSignedCalculationSummaryImageUrlAction(
                  calculationId,
                  "download",
                ),
              )
            }
            className={secondaryButtonClass}
          >
            <FileImage className="h-4 w-4" />
            Imagem
          </button>
          <button
            type="button"
            disabled={isPending || !hasPdf}
            onClick={handleSendAnalysis}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Send className="h-4 w-4" />
            {activeAction === "send" ? "Enviando..." : "Enviar"}
          </button>
        </div>
        {state ? <ActionMessage state={state} compact /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="border-l-4 border-slate-800 pl-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Relatório completo</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Documento detalhado para conferência e apresentação formal.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || !hasPdf}
              onClick={() =>
                handleArtifact("pdf-view", "PDF", () =>
                  createSignedCalculationPdfUrlAction(calculationId, "view"),
                )
              }
              className={secondaryButtonClass}
            >
              <Eye className="h-4 w-4" />
              Visualizar PDF
            </button>
            <button
              type="button"
              disabled={isPending || !hasPdf}
              onClick={() =>
                handleArtifact("pdf-download", "PDF", () =>
                  createSignedCalculationPdfUrlAction(calculationId, "download"),
                )
              }
              className={secondaryButtonClass}
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </button>
          </div>
        </div>

        <div className="border-l-4 border-red-700 pl-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-red-50 p-2 text-red-700">
              <FileImage className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Resumo visual</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Imagem objetiva para explicar os principais valores ao cliente.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || !hasPdf}
              onClick={() =>
                handleArtifact("image-view", "imagem", () =>
                  createSignedCalculationSummaryImageUrlAction(
                    calculationId,
                    "view",
                  ),
                )
              }
              className={secondaryButtonClass}
            >
              <Eye className="h-4 w-4" />
              Visualizar imagem
            </button>
            <button
              type="button"
              disabled={isPending || !hasPdf}
              onClick={() =>
                handleArtifact("image-download", "imagem", () =>
                  createSignedCalculationSummaryImageUrlAction(
                    calculationId,
                    "download",
                  ),
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Download className="h-4 w-4" />
              Baixar imagem
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className={secondaryButtonClass}
        >
          <RefreshCw className={`h-4 w-4 ${activeAction === "generate" ? "animate-spin" : ""}`} />
          {activeAction === "generate" ? "Gerando arquivos..." : "Gerar arquivos novamente"}
        </button>
        <button
          type="button"
          disabled={isPending || !hasPdf}
          onClick={handleSendAnalysis}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Send className="h-4 w-4" />
          {activeAction === "send" ? "Enviando..." : "Enviar análise"}
        </button>
      </div>

      {state ? <ActionMessage state={state} /> : null}
    </div>
  );
}

function ActionMessage({
  state,
  compact = false,
}: {
  state: CalculationActionState | TotalkSendAnalysisActionState;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"} rounded-lg border ${
        state.ok
          ? "border-teal-200 bg-teal-50 text-teal-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </div>
  );
}
