"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  createSignedDocumentUrlAction,
  softDeleteClientDocumentAction,
  updateClientDocumentAction,
  type ClientDocumentActionState,
} from "@/app/(authenticated)/clientes/document-actions";
import {
  clientDocumentBadgeClass,
  formatClientDocumentSize,
  formatClientDocumentType,
} from "@/lib/client-documents/formatters";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  clientDocumentTypes,
  type ClientDocument,
  type ClientDocumentType,
} from "@/types/client-document";

export type ClientDocumentListItem = ClientDocument & {
  uploaded_by_name: string | null;
};

type ClientDocumentListProps = {
  documents: ClientDocumentListItem[];
  canManage: boolean;
};

export function ClientDocumentList({
  documents,
  canManage,
}: ClientDocumentListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ClientDocumentActionState | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<ClientDocumentType>("rg");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  function beginEditing(document: ClientDocumentListItem) {
    setEditingDocumentId(document.id);
    setEditingType(document.document_type);
    setEditingTitle(document.title ?? "");
    setEditingDescription(document.description ?? "");
    setReplacementFile(null);
    setState(null);
  }

  function cancelEditing() {
    setEditingDocumentId(null);
    setReplacementFile(null);
  }

  function openUrl(url: string, mode: "view" | "download") {
    if (mode === "view") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  function handleSignedUrl(documentId: string, mode: "view" | "download") {
    setState(null);
    startTransition(async () => {
      const result = await createSignedDocumentUrlAction(documentId, mode);
      setState(result);

      if (result.ok && result.url) {
        openUrl(result.url, mode);
      }
    });
  }

  function handleDelete(documentId: string) {
    if (!window.confirm("Deseja excluir este documento?")) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await softDeleteClientDocumentAction(documentId);
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleUpdate(documentId: string) {
    const formData = new FormData();

    if (replacementFile) {
      formData.append("file", replacementFile);
    }

    setState(null);
    startTransition(async () => {
      const result = await updateClientDocumentAction(
        documentId,
        {
          document_type: editingType,
          title: editingTitle,
          description: editingDescription,
        },
        formData,
      );
      setState(result);

      if (result.ok) {
        cancelEditing();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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

      {documents.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Titulo</th>
                <th className="px-4 py-3 font-semibold">Arquivo</th>
                <th className="px-4 py-3 font-semibold">Tamanho</th>
                <th className="px-4 py-3 font-semibold">Enviado por</th>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((document) => (
                <Fragment key={document.id}>
                  <tr className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clientDocumentBadgeClass(document.document_type)}`}
                      >
                        {formatClientDocumentType(document.document_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-950">
                        {displayValue(document.title)}
                      </div>
                      {document.description ? (
                        <div className="mt-1 text-xs text-slate-500">{document.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{document.file_name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatClientDocumentSize(document.file_size)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {displayValue(document.uploaded_by_name)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(document.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSignedUrl(document.id, "view")}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Visualizar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSignedUrl(document.id, "download")}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Baixar
                        </button>
                        {canManage ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => beginEditing(document)}
                            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Editar / substituir
                          </button>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDelete(document.id)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {editingDocumentId === document.id ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-slate-950">
                            Editar ou substituir documento
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Atualize o tipo e os textos. Se quiser trocar o arquivo, selecione um novo documento abaixo.
                          </p>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Tipo
                              </label>
                              <select
                                value={editingType}
                                onChange={(event) => setEditingType(event.target.value as ClientDocumentType)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                              >
                                {clientDocumentTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Titulo
                              </label>
                              <input
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Descricao
                              </label>
                              <textarea
                                rows={3}
                                value={editingDescription}
                                onChange={(event) => setEditingDescription(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Substituir arquivo
                              </label>
                              <input
                                type="file"
                                onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)}
                                className="block w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                              />
                              <p className="text-xs text-slate-500">
                                Deixe em branco se quiser apenas editar as informacoes do documento atual.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleUpdate(document.id)}
                              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Salvar alteracoes
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={cancelEditing}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Nenhum documento encontrado.</p>
      )}
    </div>
  );
}
