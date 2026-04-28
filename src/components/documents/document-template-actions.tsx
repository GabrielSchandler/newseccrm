"use client";

import { Copy, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteDocumentTemplateAction,
  duplicateDocumentTemplateAction,
  setDefaultDocumentTemplateAction,
  toggleDocumentTemplateActiveAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";

type DocumentTemplateActionsProps = {
  templateId: string;
  isActive: boolean;
  isDefault: boolean;
};

export function DocumentTemplateActions({
  templateId,
  isActive,
  isDefault,
}: DocumentTemplateActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);

  function runAction(action: () => Promise<DocumentActionState>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() =>
            runAction(() =>
              toggleDocumentTemplateActiveAction(templateId, !isActive),
            )
          }
        >
          {isActive ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          {isActive ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          disabled={isPending || isDefault}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => runAction(() => setDefaultDocumentTemplateAction(templateId))}
        >
          <Star className="h-4 w-4" />
          Padrao
        </button>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => runAction(() => duplicateDocumentTemplateAction(templateId))}
        >
          <Copy className="h-4 w-4" />
          Duplicar
        </button>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => {
            if (!window.confirm("Deseja excluir este template?")) {
              return;
            }
            runAction(() => deleteDocumentTemplateAction(templateId));
          }}
        >
          Excluir
        </button>
      </div>
      {message ? (
        <p
          className={`text-xs ${
            message.ok ? "text-teal-700" : "text-red-700"
          }`}
        >
          {message.message}
        </p>
      ) : null}
    </div>
  );
}
