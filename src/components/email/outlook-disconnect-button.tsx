"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  disconnectOutlookAction,
  type IntegrationActionState,
} from "@/app/(authenticated)/integracoes/actions";

export function OutlookDisconnectButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<IntegrationActionState | null>(null);

  function handleDisconnect() {
    if (!window.confirm("Deseja desconectar o Outlook deste usuario?")) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await disconnectOutlookAction();
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
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
      <button
        type="button"
        disabled={isPending}
        onClick={handleDisconnect}
        className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Desconectando..." : "Desconectar Outlook"}
      </button>
    </div>
  );
}
