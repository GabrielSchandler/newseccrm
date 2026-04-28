"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  deleteDocumentTemplateAction,
  uploadOfficialDocxTemplateAction,
  uploadOfficialPdfTemplateAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
import { documentVariableCatalog } from "@/lib/documents/template-engine";
import {
  defaultDocumentTemplateContentHtml,
  documentTemplateSchema,
  type DocumentTemplateFormValues,
  type DocumentTemplatePayload,
} from "@/lib/documents/schema";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";

type TemplateOption = Pick<
  DocumentTemplate,
  | "id"
  | "name"
  | "document_type"
  | "is_active"
  | "original_docx_path"
  | "original_pdf_path"
>;

type DocumentTemplateFormProps = {
  defaultValues?: DocumentTemplate | null;
  submitLabel: string;
  onSubmitAction: (values: DocumentTemplatePayload) => Promise<DocumentActionState>;
  templates?: TemplateOption[];
  officialDocxUrl?: string | null;
  officialPdfUrl?: string | null;
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
  officialDocxUrl = null,
  officialPdfUrl = null,
}: DocumentTemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<DocumentActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentTemplateFormValues, undefined, DocumentTemplatePayload>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      document_type: defaultValues?.document_type ?? "contrato",
      description: defaultValues?.description ?? "",
      content_html: defaultValues?.content_html ?? defaultDocumentTemplateContentHtml,
      is_active: defaultValues?.is_active ?? true,
      is_default: defaultValues?.is_default ?? false,
    },
  });
  const disabled = isSubmitting || isPending;
  const isEditing = Boolean(defaultValues?.id);
  const hasOfficialFile = Boolean(
    defaultValues?.original_docx_path || defaultValues?.original_pdf_path,
  );

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

  function handleOfficialPdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!defaultValues?.id) {
      setMessage({
        ok: false,
        message: "Salve o template antes de vincular o PDF oficial.",
      });
      event.target.value = "";
      return;
    }

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMessage({
        ok: false,
        message: "Formato nao suportado. Envie um arquivo .pdf.",
      });
      event.target.value = "";
      return;
    }

    if (
      defaultValues.original_pdf_path &&
      !window.confirm("Deseja substituir o PDF oficial atual deste template?")
    ) {
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setMessage(null);

    startTransition(async () => {
      const result = await uploadOfficialPdfTemplateAction(defaultValues.id, formData);
      setMessage(result);

      if (result.ok) {
        router.refresh();
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
                  {template.original_pdf_path
                    ? " - PDF oficial"
                    : template.original_docx_path
                      ? " - DOCX oficial"
                      : " - aguardando DOCX/PDF"}
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

          <input type="hidden" {...register("content_html")} />

          <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-950">
                  Documento oficial do template
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  Para contratos e documentos com fidelidade alta, o CRM passa a usar
                  somente o arquivo oficial em DOCX ou PDF. O fluxo HTML antigo nao e
                  mais a base para gerar contrato.
                </p>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Fluxo recomendado</p>
                  <ol className="mt-2 space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
                    <li>1. Cadastre o template e vincule o DOCX oficial.</li>
                    <li>
                      2. Edite o arquivo no Word, mantendo imagens, marca d&apos;agua,
                      cabecalho e alinhamento.
                    </li>
                    <li>
                      3. Use placeholders como{" "}
                      <span className="font-mono text-slate-900">
                        {`{{contratante_nome}}`}
                      </span>{" "}
                      , {`{{cliente_cpf}}`} e {`{{valor_contrato}}`} no proprio
                      documento.
                    </li>
                    <li>
                      4. Reenvie o DOCX atualizado no CRM sempre que ajustar o
                      modelo.
                    </li>
                    <li>
                      5. Gere na pre-venda e abra/baixe o DOCX e o PDF oficiais.
                    </li>
                  </ol>
                </div>
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
                  <p className="font-semibold">Como usar as variaveis no Word</p>
                  <p className="mt-1 leading-6">
                    A coluna da direita lista todas as variaveis disponiveis. Copie e
                    cole no Word exatamente no formato com chaves duplas, por exemplo:
                    <span className="ml-1 font-mono">{`{{contratante_nome}}`}</span>,
                    <span className="ml-1 font-mono">{`{{titular_nome}}`}</span>,
                    <span className="ml-1 font-mono">{`{{financeira}}`}</span> e
                    <span className="ml-1 font-mono">{`{{valor_contrato}}`}</span>.
                  </p>
                  <p className="mt-2 leading-6">
                    Exemplo pratico: no seu contrato em Word, troque o nome do
                    cliente por <span className="font-mono">{`{{contratante_nome}}`}</span>,
                    o CPF por <span className="font-mono">{`{{contratante_cpf}}`}</span> e o
                    valor por <span className="font-mono">{`{{valor_contrato}}`}</span>. Depois
                    salve o arquivo em <strong>.docx</strong> e envie aqui como DOCX
                    oficial.
                  </p>
                </div>
                {defaultValues?.original_docx_filename ? (
                  <p className="text-sm font-medium text-slate-800">
                    DOCX atual: {defaultValues.original_docx_filename}
                  </p>
                ) : null}
                {defaultValues?.original_pdf_filename ? (
                  <p className="text-sm font-medium text-slate-800">
                    PDF atual: {defaultValues.original_pdf_filename}
                  </p>
                ) : null}
                {!hasOfficialFile ? (
                  <p className="text-sm font-medium text-amber-800">
                    Nenhum arquivo oficial vinculado ainda.
                  </p>
                ) : null}
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
                {officialPdfUrl ? (
                  <Link
                    href={officialPdfUrl}
                    target="_blank"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Baixar PDF
                  </Link>
                ) : null}
                <label
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isEditing
                      ? "cursor-pointer border border-teal-300 bg-white text-teal-800 hover:bg-teal-50"
                      : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  {defaultValues?.original_pdf_path
                    ? "Substituir PDF oficial"
                    : "Vincular PDF oficial"}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    disabled={disabled || !isEditing}
                    onChange={handleOfficialPdfUpload}
                  />
                </label>
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
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Como preparar e subir o contrato
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                O editor interno foi removido deste fluxo para evitar perda de
                alinhamento, imagens, marca d&apos;agua e estrutura do contrato.
                Agora o caminho recomendado e mais simples: editar o DOCX no Word,
                salvar o arquivo com as variaveis e subir aqui como arquivo oficial.
              </p>
            </div>

            {!isEditing ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Salve o template primeiro. Depois volte nesta tela para vincular o
                DOCX oficial.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <ol className="space-y-2 pl-5 leading-6">
                  <li>1. Abra o contrato original no Word.</li>
                  <li>
                    2. Substitua os dados fixos pelas variaveis que estao na coluna da
                    direita.
                  </li>
                  <li>3. Salve o arquivo em <strong>.docx</strong>.</li>
                  <li>4. Clique em <strong>Vincular DOCX oficial</strong>.</li>
                  <li>5. Escolha o arquivo .docx preparado no Word.</li>
                  <li>
                    6. Confira se o nome do arquivo apareceu em <strong>DOCX atual</strong>.
                  </li>
                  <li>
                    7. Se precisar mexer no contrato, edite no Word e use{" "}
                    <strong>Substituir DOCX oficial</strong>.
                  </li>
                  <li>
                    8. Gere o documento na pre-venda usando o template oficial.
                  </li>
                </ol>
                {defaultValues?.original_docx_path ? (
                  <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-teal-900">
                    DOCX oficial vinculado com sucesso. Agora ajuste o arquivo no
                    Word sempre que precisar e reenvie a versao nova por aqui.
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </main>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Variaveis</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Copie estes placeholders para dentro do DOCX oficial. Eles serao trocados
            pelos dados da pre-venda na hora de gerar o documento final.
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
