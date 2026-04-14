"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateDocumentAction,
  generateOfficialDocumentAction,
  generateOfficialPdfDocumentAction,
  previewDocumentAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
import { DocumentRenderedContent } from "@/components/documents/document-rendered-content";
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
  const [preview, setPreview] = useState("");
  const [generatedDocumentId, setGeneratedDocumentId] = useState("");
  const [state, setState] = useState<DocumentActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const disabled = isPending || !selectedTemplateId;

  function handlePreview() {
    if (!selectedTemplateId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await previewDocumentAction(preSaleId, selectedTemplateId);
      setState(result);
      setPreview(result.content ?? "");
      setGeneratedDocumentId("");
    });
  }

  function handleGenerate() {
    if (!selectedTemplateId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = selectedTemplate?.original_pdf_path
        ? await generateOfficialPdfDocumentAction(preSaleId, selectedTemplateId)
        : selectedTemplate?.original_docx_path
          ? await generateOfficialDocumentAction(preSaleId, selectedTemplateId)
          : await generateDocumentAction(preSaleId, selectedTemplateId);
      setState(result);
      setPreview(result.content ?? preview);
      setGeneratedDocumentId(result.documentId ?? "");
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
                  Selecione um template, confira o preview e gere o conteudo final.
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
                      <label
                        className="text-sm font-medium text-slate-700"
                        htmlFor="document-template"
                      >
                        Template
                      </label>
                      <select
                        id="document-template"
                        value={selectedTemplateId}
                        disabled={isPending}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                        onChange={(event) => {
                          setSelectedTemplateId(event.target.value);
                          setPreview("");
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
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={handlePreview}
                    >
                      {isPending ? "Gerando..." : "Visualizar preview"}
                    </button>
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
                            : "Gerar por HTML"}
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
                            ? "Este template tem DOCX oficial. A emissao final sera gerada em DOCX e tentara converter para PDF."
                            : "Este template ainda nao tem arquivo oficial. A geracao usara o fluxo antigo por HTML."}
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
                      <Link
                        href={`/documentos/gerados/${generatedDocumentId}/imprimir?print=1`}
                        target="_blank"
                        className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        Abrir PDF HTML
                      </Link>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Preview</p>
                    {preview ? (
                      <div className="max-h-[520px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <DocumentRenderedContent html={preview} />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        Clique em Visualizar preview para conferir o documento.
                      </div>
                    )}
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
