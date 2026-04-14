"use client";

import { useEffect } from "react";

type DocumentPrintActionsProps = {
  autoPrint?: boolean;
};

export function DocumentPrintActions({ autoPrint = false }: DocumentPrintActionsProps) {
  useEffect(() => {
    if (!autoPrint) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.print();
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [autoPrint]);

  return (
    <button
      type="button"
      className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
      onClick={() => window.print()}
    >
      Baixar PDF
    </button>
  );
}
