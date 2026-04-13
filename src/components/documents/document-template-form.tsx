"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { DocumentActionState } from "@/app/(authenticated)/documentos/actions";
import {
  documentTemplateSchema,
  type DocumentTemplatePayload,
} from "@/lib/documents/schema";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";

type DocumentTemplateFormProps = {
  defaultValues?: DocumentTemplate | null;
  submitLabel: string;
  onSubmitAction: (values: DocumentTemplatePayload) => Promise<DocumentActionState>;
};

const variables = [
  "{{cliente_nome}}",
  "{{cliente_cpf}}",
  "{{cliente_endereco}}",
  "{{titular_nome}}",
  "{{valor_contrato}}",
  "{{financeira}}",
  "{{data_atual}}",
];

export function DocumentTemplateForm({
  defaultValues,
  submitLabel,
  onSubmitAction,
}: DocumentTemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentTemplatePayload>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      type: defaultValues?.type ?? "contrato",
      content: defaultValues?.content ?? "",
    },
  });
  const disabled = isSubmitting || isPending;

  function onValidSubmit(values: DocumentTemplatePayload) {
    setMessage(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);
      setMessage(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <form
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={handleSubmit(onValidSubmit)}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="name">
            Nome do template <span className="text-red-600">*</span>
          </label>
          <input
            id="name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("name")}
          />
          {errors.name?.message ? (
            <p className="text-sm text-red-600">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="type">
            Tipo <span className="text-red-600">*</span>
          </label>
          <select
            id="type"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            disabled={disabled}
            {...register("type")}
          >
            {documentTemplateTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.type?.message ? (
            <p className="text-sm text-red-600">{errors.type.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="content">
          Conteudo <span className="text-red-600">*</span>
        </label>
        <textarea
          id="content"
          rows={16}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          disabled={disabled}
          {...register("content")}
        />
        {errors.content?.message ? (
          <p className="text-sm text-red-600">{errors.content.message}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">Variaveis disponiveis</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {variables.map((variable) => (
            <code
              key={variable}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {variable}
            </code>
          ))}
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.ok
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {disabled ? "Salvando..." : submitLabel}
        </button>
        <Link
          href="/documentos/templates"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>
    </form>
  );
}
