"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

type ChangeNoteModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
};

export function ChangeNoteModal({
  isOpen,
  title,
  description,
  confirmLabel,
  pending = false,
  onClose,
  onConfirm,
}: ChangeNoteModalProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      setNote("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmedNote = note.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={pending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Essa anotacao fica salva na linha do tempo do cliente para consulta futura.
          </div>
          <div className="space-y-2">
            <label
              htmlFor="timeline-change-note"
              className="text-sm font-medium text-slate-700"
            >
              O que foi feito e por que
            </label>
            <textarea
              id="timeline-change-note"
              rows={6}
              value={note}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: Atualizei os dados do cliente apos envio de comprovante novo e corrigi a divergencia do endereco."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || !trimmedNote}
              onClick={() => onConfirm(trimmedNote)}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? "Salvando..." : confirmLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
