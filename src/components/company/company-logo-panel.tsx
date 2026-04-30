"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  removeCompanyLogoAction,
  uploadCompanyLogoAction,
  type CompanyActionState,
} from "@/app/(authenticated)/empresa/actions";

type CompanyLogoPanelProps = {
  logoUrl: string | null;
  logoFileName: string | null;
};

export function CompanyLogoPanel({
  logoUrl,
  logoFileName,
}: CompanyLogoPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<CompanyActionState | null>(null);

  function applyResult(result: CompanyActionState) {
    setState(result);

    if (result.ok && result.redirectTo) {
      router.push(result.redirectTo);
      router.refresh();
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">Identidade visual</h3>
      <p className="mt-1 text-sm text-slate-600">
        Suba a logo usada nas telas futuras, documentos e PDFs da empresa.
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        {logoUrl ? (
          <div className="space-y-3">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src={logoUrl}
                alt="Logo da empresa"
                className="h-full w-full object-contain p-4"
              />
            </div>
            <p className="text-sm text-slate-600">
              Arquivo atual: {logoFileName || "-"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma logo vinculada ainda.</p>
        )}
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.currentTarget);
          setState(null);
          startTransition(async () => {
            const result = await uploadCompanyLogoAction(formData);
            applyResult(result);
            if (result.ok && inputRef.current) {
              inputRef.current.value = "";
            }
          });
        }}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Enviando..." : "Enviar logo"}
        </button>
      </form>

      {logoUrl ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm("Deseja remover a logo da empresa?")) {
              return;
            }

            setState(null);
            startTransition(async () => {
              const result = await removeCompanyLogoAction();
              applyResult(result);
            });
          }}
          className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Remover logo
        </button>
      ) : null}

      {state ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </section>
  );
}
