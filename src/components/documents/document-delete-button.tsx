"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteGeneratedDocumentAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";

type DocumentDeleteButtonProps = {
  documentId: string;
  variant?: "button" | "inline";
};

export function DocumentDeleteButton({
  documentId,
  variant = "button",
}: DocumentDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);

  function handleDelete() {
    if (!window.confirm("Deseja excluir este documento gerado?")) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteGeneratedDocumentAction(documentId);
      setMessage(result);

      if (result.ok) {
        if (variant === "button") {
          router.push("/documentos");
        }
        router.refresh();
      }
    });
  }

  return (
    <div className={variant === "inline" ? "space-y-2" : "space-y-3"}>
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
