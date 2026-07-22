"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RunnerState = {
  status: "idle" | "running" | "done" | "error";
  message: string;
};

const initialState: RunnerState = {
  status: "idle",
  message: "Pronto para gerar um backup salvo no Supabase Storage.",
};

async function getErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Não foi possível gerar o backup.";
  } catch {
    return "Não foi possível gerar o backup.";
  }
}

export function StoredBackupRunner() {
  const router = useRouter();
  const [state, setState] = useState<RunnerState>(initialState);
  const isRunning = state.status === "running";

  async function handleGenerate() {
    try {
      setState({
        status: "running",
        message: "Gerando backup e salvando no Supabase Storage...",
      });

      const response = await fetch("/api/backups/cloud", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setState({
        status: "done",
        message: "Backup salvo. Atualizando o histórico...",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o backup.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isRunning}
        className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isRunning ? "Gerando backup..." : "Gerar backup salvo agora"}
      </button>
      <p
        className={`text-sm ${
          state.status === "error" ? "text-red-700" : "text-slate-600"
        }`}
      >
        {state.message}
      </p>
    </div>
  );
}
