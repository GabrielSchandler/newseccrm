"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createGeneratedDocumentFileUrlAction,
  generateOfficialDocumentAction,
  generateOfficialPdfDocumentAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
import { FormFieldLabel } from "@/components/form-field-label";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";

type GenerateDocumentModalProps = {
  preSaleId: string;
  templates: DocumentTemplate[];
};

function formatTemplateType(type: DocumentTemplate["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export function GenerateDocumentModal({
  preSaleId,
  templates,
}: GenerateDocumentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [generatedDocumentId, setGeneratedDocumentId] = useState("");
  const [state, setState] = useState<DocumentActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const canGenerateOfficial = Boolean(
    selectedTemplate?.original_docx_path || selectedTemplate?.original_pdf_path,
  );
  const disabled = isPending || !selectedTemplateId || !canGenerateOfficial;

  function handleGenerate() {
    if (!selectedTemplateId || !canGenerateOfficial) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = selectedTemplate?.original_pdf_path
        ? await generateOfficialPdfDocumentAction(preSaleId, selectedTemplateId)
        : selectedTemplate?.original_docx_path
          ? await generateOfficialDocumentAction(preSaleId, selectedTemplateId)
          : {
              ok: false,
              message:
                "Este template ainda nao possui arquivo oficial vinculado. Vincule o DOCX ou o PDF oficial no cadastro do template.",
            };
      setState(result);
      setGeneratedDocumentId(result.documentId ?? "");
    });
  }

  function handleOpenOfficialPdf() {
    if (!generatedDocumentId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await createGeneratedDocumentFileUrlAction(
        generatedDocumentId,
        "pdf",
        "view",
      );
      setState(result);

      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  function handleDownloadOfficialDocx() {
    if (!generatedDocumentId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await createGeneratedDocumentFileUrlAction(
        generatedDocumentId,
        "docx",
        "download",
      );
      setState(result);

      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  function handleDownloadOfficialPdf() {
    if (!generatedDocumentId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await createGeneratedDocumentFileUrlAction(
        generatedDocumentId,
        "pdf",
        "download",
      );
      setState(result);

      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        onClick={() => {
          setIsOpen(true);
          setState(null);
        }}
      >
        <FileText className="h-4 w-4" />
        Gerar documento
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Gerar documento
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecione um template oficial e gere o documento final a partir do
                  arquivo DOCX ou PDF vinculado.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {templates.length ? (
                <>
                    <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                    <div className="space-y-2">
                      <FormFieldLabel
                        htmlFor="document-template"
                        label="Template"
                        requirement="required"
                      />
                      <select
                        id="document-template"
                        value={selectedTemplateId}
                        disabled={isPending}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                        onChange={(event) => {
                          setSelectedTemplateId(event.target.value);
                          setGeneratedDocumentId("");
                          setState(null);
                        }}
                      >
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} - {formatTemplateType(template.document_type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                      Contratos oficiais nao usam mais preview HTML para emissao.
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={handleGenerate}
                    >
                      {isPending
                        ? "Processando..."
                        : selectedTemplate?.original_pdf_path
                          ? "Gerar PDF oficial"
                          : selectedTemplate?.original_docx_path
                            ? "Gerar documento oficial"
                            : "Vincule arquivo oficial"}
                    </button>
                  </div>

                  {selectedTemplate ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <p>
                        Tipo selecionado:{" "}
                        {formatTemplateType(selectedTemplate.document_type)}
                      </p>
                      <p className="mt-1">
                        {selectedTemplate.original_pdf_path
                          ? "Este template tem PDF oficial. A emissao final vai preencher campos do PDF sem reconverter o layout."
                          : selectedTemplate.original_docx_path
                            ? "Este template tem DOCX oficial. A emissao final sera gerada a partir do Word original, preservando melhor a estrutura do contrato."
                            : "Este template ainda nao tem arquivo oficial. Vincule um DOCX ou PDF oficial antes de gerar documentos na pre-venda."}
                      </p>
                    </div>
                  ) : null}

                  {generatedDocumentId ? (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                      <Link
                        href={`/documentos/gerados/${generatedDocumentId}`}
                        className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                      >
                        Abrir documento
                      </Link>
                      {selectedTemplate?.original_pdf_path ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={isPending}
                            onClick={handleOpenOfficialPdf}
                          >
                            Abrir PDF oficial
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={isPending}
                            onClick={handleDownloadOfficialPdf}
                          >
                            Baixar PDF oficial
                          </button>
                        </>
                      ) : selectedTemplate?.original_docx_path ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={isPending}
                            onClick={handleDownloadOfficialDocx}
                          >
                            Baixar DOCX oficial
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    O documento final sera aberto a partir do arquivo oficial gerado.
                    Para contratos, o CRM nao usa mais o HTML como fonte principal.
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Nenhum template cadastrado. Um admin ou gerente precisa criar um
                  template antes de gerar documentos.
                </div>
              )}

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
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
