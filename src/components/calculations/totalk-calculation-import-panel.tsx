"use client";

import { Search, Wand2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  importTotalkCalculationDataAction,
  type TotalkImportCalculationActionState,
} from "@/app/(authenticated)/calculos/totalk-actions";
import { formatPhone } from "@/lib/clients/masks";
import type { FinancingCalculationFormValues } from "@/lib/calculations/schema";

type TotalkCalculationImportPanelProps = {
  disabled?: boolean;
  currentPhone?: string | null;
  onApply: (fields: Partial<FinancingCalculationFormValues>) => void;
};

export function TotalkCalculationImportPanel({
  disabled = false,
  currentPhone,
  onApply,
}: TotalkCalculationImportPanelProps) {
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [state, setState] = useState<TotalkImportCalculationActionState | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const isDisabled = disabled || isPending;

  useEffect(() => {
    if (!phone && currentPhone) {
      setPhone(currentPhone);
    }
  }, [currentPhone, phone]);

  function handleImport() {
    setState(null);
    startTransition(async () => {
      const result = await importTotalkCalculationDataAction(phone);
      setState(result);

      if (result.ok && result.fields) {
        onApply(result.fields);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-teal-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-teal-100 bg-teal-50/70 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
            <Wand2 className="h-3.5 w-3.5" />
            Integração Totalk
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">
            Importar dados da anotação interna
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Informe o telefone do contato. O CRM busca a anotação interna da Totalk,
            preenche os campos possíveis e aponta o que ainda precisa ser conferido.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            value={phone}
            disabled={isDisabled}
            inputMode="tel"
            placeholder="Telefone do cliente"
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <button
            type="button"
            disabled={isDisabled || !phone.trim()}
            onClick={handleImport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Search className="h-4 w-4" />
            {isPending ? "Importando..." : "Importar dados"}
          </button>
        </div>
      </div>

      {state ? (
        <div
          className={`m-5 rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold">{state.message}</p>

          {state.ok && state.summary?.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {state.summary.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded-lg border border-teal-100 bg-white px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {state.missingFields?.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <p className="font-semibold">Campos para revisar antes de salvar:</p>
              <p className="mt-1">{state.missingFields.join(", ")}</p>
            </div>
          ) : null}

          {state.warnings?.length ? (
            <div className="mt-3 space-y-1 text-amber-900">
              {state.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
