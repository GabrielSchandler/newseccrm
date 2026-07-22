"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  updateLegalWorkflowStageAction,
  type LegalWorkflowActionState,
} from "@/app/(authenticated)/juridico/workflow-actions";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import type { LegalWorkflowStageDefinition } from "@/lib/legal/workflow";

type LegalStageSelectProps = {
  preSaleId: string;
  currentStageId: string;
  stages: LegalWorkflowStageDefinition[];
};

export function LegalStageSelect({
  preSaleId,
  currentStageId,
  stages,
}: LegalStageSelectProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState(currentStageId);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [message, setMessage] = useState<LegalWorkflowActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedStage(currentStageId);
  }, [currentStageId]);

  function confirmStageChange(note: string) {
    if (!pendingStage) {
      return;
    }

    startTransition(async () => {
      const result = await updateLegalWorkflowStageAction(preSaleId, pendingStage, note);
        setMessage(result);

      if (!result.ok) {
        setSelectedStage(currentStageId);
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
          const nextStage = event.target.value;

          if (nextStage === currentStageId) {
            setSelectedStage(currentStageId);
            return;
          }

          setSelectedStage(nextStage);
          setMessage(null);
          setPendingStage(nextStage);
        }}
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
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
        title="Registrar mudança na etapa jurídica"
        description="Descreva o que foi feito com este cliente e por que ele está mudando de etapa na esteira."
        confirmLabel="Salvar etapa com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStage(null);
          setSelectedStage(currentStageId);
        }}
        onConfirm={confirmStageChange}
      />
    </div>
  );
}
