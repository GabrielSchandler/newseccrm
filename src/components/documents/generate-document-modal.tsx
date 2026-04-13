"use client";

import { FileText, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  generateDocumentAction,
  previewDocumentAction,
  type DocumentActionState,
} from "@/app/(authenticated)/documentos/actions";
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
    });
  }

  function handleGenerate() {
    if (!selectedTemplateId) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await generateDocumentAction(preSaleId, selectedTemplateId);
      setState(result);
      setPreview(result.content ?? preview);
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
                      {isPending ? "Salvando..." : "Gerar"}
                    </button>
                  </div>

                  {selectedTemplate ? (
                    <p className="text-sm text-slate-600">
                      Tipo selecionado: {formatTemplateType(selectedTemplate.document_type)}
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="preview">
                      Preview
                    </label>
                    <textarea
                      id="preview"
                      rows={16}
                      readOnly
                      value={preview}
                      placeholder="Clique em Visualizar preview para conferir o documento."
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm leading-6 text-slate-900 outline-none"
                    />
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
