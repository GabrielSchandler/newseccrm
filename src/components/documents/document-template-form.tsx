"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useCallback, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  deleteDocumentTemplateAction,
  importDocxTemplateAction,
  previewTemplateContentAction,
  uploadOfficialDocxTemplateAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
import { documentVariableCatalog } from "@/lib/documents/template-engine";
import {
  documentTemplateSchema,
  type DocumentTemplateFormValues,
  type DocumentTemplatePayload,
} from "@/lib/documents/schema";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";
import { DocumentRichEditor } from "./document-rich-editor";

type TemplateOption = Pick<
  DocumentTemplate,
  "id" | "name" | "document_type" | "is_active" | "original_docx_path"
>;

export type PreviewPreSaleOption = {
  id: string;
  label: string;
};

type DocumentTemplateFormProps = {
  defaultValues?: DocumentTemplate | null;
  submitLabel: string;
  onSubmitAction: (values: DocumentTemplatePayload) => Promise<DocumentActionState>;
  templates?: TemplateOption[];
  previewPreSales?: PreviewPreSaleOption[];
  officialDocxUrl?: string | null;
};

type EditorActions = {
  insertVariable: (variable: string) => void;
};

function formatTemplateType(type: DocumentTemplate["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

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
  templates = [],
  previewPreSales = [],
  officialDocxUrl = null,
}: DocumentTemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);
  const [editorActions, setEditorActions] = useState<EditorActions | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedPreviewPreSale, setSelectedPreviewPreSale] = useState(
    previewPreSales[0]?.id ?? "",
  );
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
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
  const contentHtml = watch("content_html") ?? "";
  const handleEditorReady = useCallback((actions: EditorActions) => {
    setEditorActions(actions);
  }, []);

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
        setPreviewMode(false);
      }
    });

    event.target.value = "";
  }

  function handleOfficialDocxUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!defaultValues?.id) {
      setMessage({
        ok: false,
        message: "Salve o template antes de vincular o DOCX oficial.",
      });
      event.target.value = "";
      return;
    }

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

    if (
      defaultValues.original_docx_path &&
      !window.confirm("Deseja substituir o DOCX oficial atual deste template?")
    ) {
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setMessage(null);

    startTransition(async () => {
      const result = await uploadOfficialDocxTemplateAction(defaultValues.id, formData);
      setMessage(result);

      if (result.ok) {
        router.refresh();
      }
    });

    event.target.value = "";
  }

  function insertVariable(variable: string) {
    if (editorActions) {
      editorActions.insertVariable(variable);
      return;
    }

    copyVariable(variable);
  }

  function onValidSubmit(values: DocumentTemplatePayload) {
    setMessage(null);

    startTransition(async () => {
      const result = await onSubmitAction(values);
      setMessage(result);
    });
  }

  function handlePreview() {
    if (!selectedPreviewPreSale) {
      setMessage({
        ok: false,
        message: "Selecione uma pre-venda para gerar o preview.",
      });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await previewTemplateContentAction(
        selectedPreviewPreSale,
        getValues("content_html"),
      );
      setMessage(result);

      if (result.ok && result.content) {
        setPreviewHtml(result.content);
        setPreviewMode(true);
      }
    });
  }

  function handleDeleteTemplate() {
    if (!defaultValues?.id) {
      return;
    }

    if (!window.confirm("Deseja excluir este template?")) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteDocumentTemplateAction(defaultValues.id);
      setMessage(result);

      if (result.ok) {
        router.push("/documentos/templates");
        router.refresh();
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onValidSubmit)}>
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Modelos</h2>
            <Link
              href="/documentos/templates/novo"
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
            >
              Novo
            </Link>
          </div>
          <div className="mt-4 max-h-[760px] space-y-2 overflow-y-auto pr-1">
            {templates.map((template) => (
              <Link
                key={template.id}
                href={`/documentos/templates/${template.id}/editar`}
                className={`block rounded-lg border px-3 py-2.5 text-sm transition ${
                  template.id === defaultValues?.id
                    ? "border-teal-300 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block font-semibold">{template.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {formatTemplateType(template.document_type)}
                  {template.is_active ? "" : " - inativo"}
                  {template.original_docx_path ? " - DOCX oficial" : ""}
                </span>
              </Link>
            ))}
            {!templates.length ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Nenhum template cadastrado.
              </p>
            ) : null}
          </div>
        </aside>

        <main className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    DOCX oficial do documento
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Este arquivo e a fonte principal para gerar DOCX/PDF com maior
                    fidelidade. O editor HTML abaixo fica como apoio e preview.
                  </p>
                  {defaultValues?.original_docx_filename ? (
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      Arquivo atual: {defaultValues.original_docx_filename}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Nenhum DOCX oficial vinculado ainda.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {officialDocxUrl ? (
                    <Link
                      href={officialDocxUrl}
                      target="_blank"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Baixar DOCX
                    </Link>
                  ) : null}
                  <label
                    className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isEditing
                        ? "cursor-pointer border border-teal-300 bg-white text-teal-800 hover:bg-teal-50"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    {defaultValues?.original_docx_path
                      ? "Substituir DOCX oficial"
                      : "Vincular DOCX oficial"}
                    <input
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      disabled={disabled || !isEditing}
                      onChange={handleOfficialDocxUpload}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <label
                  className="text-sm font-medium text-slate-700"
                  htmlFor="content_html"
                >
                  Editor visual <span className="text-red-600">*</span>
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Preview aproximado salvo em content_html. O documento oficial
                  final usa o DOCX vinculado acima quando existir.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  {isPending ? "Importando..." : "Importar DOCX para editor"}
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    disabled={disabled}
                    onChange={handleDocxImport}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  disabled={disabled || !previewPreSales.length}
                  onClick={handlePreview}
                >
                  Visualizar preview
                </button>
                {previewMode ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setPreviewMode(false)}
                  >
                    Voltar para edicao
                  </button>
                ) : null}
              </div>
            </div>

            {previewPreSales.length ? (
              <select
                value={selectedPreviewPreSale}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                disabled={disabled}
                onChange={(event) => setSelectedPreviewPreSale(event.target.value)}
              >
                {previewPreSales.map((preSale) => (
                  <option key={preSale.id} value={preSale.id}>
                    Preview com {preSale.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Cadastre uma pre-venda para visualizar preview com dados reais.
              </p>
            )}

            <input type="hidden" {...register("content_html")} />
            {previewMode ? (
              <div className="min-h-[620px] rounded-lg border border-slate-300 bg-white px-8 py-8 text-sm leading-7 text-slate-950">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            ) : (
              <DocumentRichEditor
                value={contentHtml}
                disabled={disabled}
                onChange={(html) =>
                  setValue("content_html", html, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onReady={handleEditorReady}
              />
            )}
            {errors.content_html?.message ? (
              <p className="text-sm text-red-600">{errors.content_html.message}</p>
            ) : null}
          </div>
        </main>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Dados</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Clique em uma variavel para inserir no ponto do cursor.
          </p>
          <div className="mt-4 max-h-[760px] space-y-4 overflow-y-auto pr-1">
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
                      onClick={() => insertVariable(variable)}
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

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {disabled ? "Salvando..." : submitLabel}
        </button>
        <Link
          href="/documentos/templates/novo"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Novo
        </Link>
        {defaultValues?.id ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handleDeleteTemplate}
          >
            Excluir
          </button>
        ) : null}
        <Link
          href="/documentos/templates"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Voltar para templates
        </Link>
      </div>
    </form>
  );
}
