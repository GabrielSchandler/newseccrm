"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  importDocxTemplateAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
import { documentVariableCatalog } from "@/lib/documents/template-engine";
import {
  documentTemplateSchema,
  type DocumentTemplateFormValues,
  type DocumentTemplatePayload,
} from "@/lib/documents/schema";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";

type DocumentTemplateFormProps = {
  defaultValues?: DocumentTemplate | null;
  submitLabel: string;
  onSubmitAction: (values: DocumentTemplatePayload) => Promise<DocumentActionState>;
};

function copyVariable(variable: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(`{{${variable}}}`);
}

export function DocumentTemplateForm({
  defaultValues,
  submitLabel,
  onSubmitAction,
}: DocumentTemplateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DocumentTemplateFormValues, undefined, DocumentTemplatePayload>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      document_type: defaultValues?.document_type ?? "contrato",
      description: defaultValues?.description ?? "",
      content_html: defaultValues?.content_html ?? "",
      is_active: defaultValues?.is_active ?? true,
      is_default: defaultValues?.is_default ?? false,
    },
  });
  const disabled = isSubmitting || isPending;
  const isEditing = Boolean(defaultValues?.id);

  function handleDocxImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setMessage({
        ok: false,
        message: "Formato nao suportado. Envie um arquivo .docx.",
      });
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setMessage(null);

    startTransition(async () => {
      const result = await importDocxTemplateAction(formData);
      setMessage(result);

      if (result.ok && result.content) {
        if (
          isEditing &&
          getValues("content_html").trim() &&
          !window.confirm(
            "Deseja substituir o conteúdo atual pelo conteúdo importado do DOCX?",
          )
        ) {
          setMessage({
            ok: true,
            message: "Importacao concluida, mas o conteudo atual foi mantido.",
          });
          return;
        }

        setValue("content_html", result.content, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });

    event.target.value = "";
  }

  function onValidSubmit(values: DocumentTemplatePayload) {
    setMessage(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);
      setMessage(result);
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onValidSubmit)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="document_type"
              >
                Tipo <span className="text-red-600">*</span>
              </label>
              <select
                id="document_type"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                {...register("document_type")}
              >
                {documentTemplateTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {errors.document_type?.message ? (
                <p className="text-sm text-red-600">
                  {errors.document_type.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="description"
            >
              Descricao
            </label>
            <input
              id="description"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              disabled={disabled}
              placeholder="Uso interno do modelo"
              {...register("description")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                disabled={disabled}
                {...register("is_active")}
              />
              <span>
                Template ativo
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                  Apenas templates ativos aparecem para geracao na pre-venda.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                disabled={disabled}
                {...register("is_default")}
              />
              <span>
                Template padrao
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                  Mantem um padrao por tipo de documento para a empresa.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <label className="text-sm font-medium text-slate-700" htmlFor="content_html">
                Conteudo do template <span className="text-red-600">*</span>
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                {isPending ? "Importando..." : "Importar DOCX"}
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  disabled={disabled}
                  onChange={handleDocxImport}
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              O DOCX e convertido para HTML e pode ser editado antes de salvar.
            </p>
            <textarea
              id="content_html"
              rows={22}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              disabled={disabled}
              placeholder="Digite texto ou HTML simples usando variaveis como {{contratante_nome}}."
              {...register("content_html")}
            />
            {errors.content_html?.message ? (
              <p className="text-sm text-red-600">{errors.content_html.message}</p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Variaveis disponiveis
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Clique em uma variavel para copiar.
          </p>
          <div className="mt-4 max-h-[720px] space-y-4 overflow-y-auto pr-1">
            {documentVariableCatalog.map((group) => (
              <div key={group.group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.group}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.variables.map((variable) => (
                    <button
                      type="button"
                      key={variable}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                      onClick={() => copyVariable(variable)}
                    >
                      {`{{${variable}}}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
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
