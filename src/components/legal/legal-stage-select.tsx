"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  updateLegalWorkflowStageAction,
  type JuridicoActionState,
} from "@/app/(authenticated)/juridico/actions";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import { legalWorkflowStages, type LegalWorkflowStage } from "@/lib/legal/workflow";

type LegalStageSelectProps = {
  preSaleId: string;
  currentStage: LegalWorkflowStage;
};

export function LegalStageSelect({
  preSaleId,
  currentStage,
}: LegalStageSelectProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<LegalWorkflowStage>(currentStage);
  const [pendingStage, setPendingStage] = useState<LegalWorkflowStage | null>(null);
  const [message, setMessage] = useState<JuridicoActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedStage(currentStage);
  }, [currentStage]);

  function confirmStageChange(note: string) {
    if (!pendingStage) {
      return;
    }

    startTransition(async () => {
      const result = await updateLegalWorkflowStageAction(preSaleId, pendingStage, note);
      setMessage(result);

      if (!result.ok) {
        setSelectedStage(currentStage);
        return;
      }

      router.refresh();
    });
    setPendingStage(null);
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={`legal-stage-${preSaleId}`}
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Etapa atual
      </label>
      <select
        id={`legal-stage-${preSaleId}`}
        value={selectedStage}
        disabled={isPending}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        onChange={(event) => {
          const nextStage = event.target.value as LegalWorkflowStage;

          if (nextStage === currentStage) {
            setSelectedStage(currentStage);
            return;
          }

          setSelectedStage(nextStage);
          setMessage(null);
          setPendingStage(nextStage);
        }}
      >
        {legalWorkflowStages.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.shortLabel}
          </option>
        ))}
      </select>
      {message ? (
        <p
          className={`text-xs ${
            message.ok ? "text-teal-700" : "text-red-600"
          }`}
        >
          {message.message}
        </p>
      ) : null}

      <ChangeNoteModal
        isOpen={Boolean(pendingStage)}
        title="Registrar mudanca na etapa juridica"
        description="Descreva o que foi feito com este cliente e por que ele esta mudando de etapa na esteira."
        confirmLabel="Salvar etapa com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStage(null);
          setSelectedStage(currentStage);
        }}
        onConfirm={confirmStageChange}
      />
    </div>
  );
}
