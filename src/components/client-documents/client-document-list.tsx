"use client";

import { ChevronDown, FileText } from "lucide-react";
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
  clientDocumentGroupAccentClass,
  formatClientDocumentSize,
  formatClientDocumentType,
} from "@/lib/client-documents/formatters";
import {
  closePreparedDocumentTab,
  openPreparedDocumentTab,
  prepareDocumentTab,
} from "@/lib/browser/open-document-tab";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  clientDocumentAcceptedInputTypes,
  clientDocumentTypes,
  normalizeClientDocumentType,
  type ClientDocument,
  type ClientDocumentType,
} from "@/types/client-document";

export type ClientDocumentListItem = ClientDocument & {
  uploaded_by_name: string | null;
};

type ClientDocumentListProps = {
  documents: ClientDocumentListItem[];
  canManage: boolean;
  visibleTypes?: ClientDocumentType[];
};

const initialOpenGroups: Record<ClientDocumentType, boolean> = {
  documentacao: true,
  extrajudicial: true,
  processual: true,
};

export function ClientDocumentList({
  documents,
  canManage,
  visibleTypes,
}: ClientDocumentListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ClientDocumentActionState | null>(null);
  const [openGroups, setOpenGroups] =
    useState<Record<ClientDocumentType, boolean>>(initialOpenGroups);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<ClientDocumentType>("documentacao");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  const documentTypesToShow = visibleTypes?.length
    ? clientDocumentTypes.filter((type) => visibleTypes.includes(type.value))
    : clientDocumentTypes;
  const groupedDocuments = documentTypesToShow.map((type) => ({
    ...type,
    documents: documents.filter(
      (document) => normalizeClientDocumentType(document.document_type) === type.value,
    ),
  }));

  function beginEditing(document: ClientDocumentListItem) {
    setEditingDocumentId(document.id);
    setEditingType(normalizeClientDocumentType(document.document_type));
    setEditingTitle(document.title ?? "");
    setEditingDescription(document.description ?? "");
    setReplacementFile(null);
    setState(null);
  }

  function cancelEditing() {
    setEditingDocumentId(null);
    setReplacementFile(null);
  }

  function toggleGroup(type: ClientDocumentType) {
    setOpenGroups((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  function openUrl(url: string, mode: "view" | "download", tab: Window | null) {
    if (mode === "view") {
      openPreparedDocumentTab(url, tab);
      return;
    }

    closePreparedDocumentTab(tab);

    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  function handleSignedUrl(documentId: string, mode: "view" | "download") {
    setState(null);
    const preparedTab = mode === "view" ? prepareDocumentTab() : null;

    startTransition(async () => {
      const result = await createSignedDocumentUrlAction(documentId, mode);
      setState(result);

      if (result.ok && result.url) {
        openUrl(result.url, mode, preparedTab);
      } else {
        closePreparedDocumentTab(preparedTab);
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

  function handleTypeChange(document: ClientDocumentListItem, nextType: ClientDocumentType) {
    if (normalizeClientDocumentType(document.document_type) === nextType) {
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await updateClientDocumentAction(
        document.id,
        {
          document_type: nextType,
          title: document.title,
          description: document.description,
        },
        new FormData(),
      );
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
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
        <div className="space-y-4">
          {groupedDocuments.map((group) => {
            const isOpen = openGroups[group.value];

            return (
              <section
                key={group.value}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.value)}
                  className="flex w-full items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 text-left transition hover:bg-slate-50"
                  aria-expanded={isOpen}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-10 w-1.5 shrink-0 rounded-full ${clientDocumentGroupAccentClass(
                        group.value,
                      )}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-950">
                        {group.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {group.documents.length
                          ? `${group.documents.length} documento(s) nesta categoria.`
                          : "Nenhum documento nesta categoria."}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${clientDocumentBadgeClass(
                        group.value,
                      )}`}
                    >
                      {group.documents.length}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>

                {isOpen ? (
                  group.documents.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Tipo</th>
                            <th className="px-4 py-3 font-semibold">Título</th>
                            <th className="px-4 py-3 font-semibold">Arquivo</th>
                            <th className="px-4 py-3 font-semibold">Tamanho</th>
                            <th className="px-4 py-3 font-semibold">Enviado por</th>
                            <th className="px-4 py-3 font-semibold">Data</th>
                            <th className="px-4 py-3 font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.documents.map((document) => {
                            const currentType = normalizeClientDocumentType(
                              document.document_type,
                            );

                            return (
                              <Fragment key={document.id}>
                                <tr className="transition hover:bg-slate-50">
                                  <td className="px-4 py-3">
                                    {canManage ? (
                                      <select
                                        value={currentType}
                                        disabled={isPending}
                                        onChange={(event) =>
                                          handleTypeChange(
                                            document,
                                            event.target.value as ClientDocumentType,
                                          )
                                        }
                                        className="w-full min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-70"
                                        aria-label={`Alterar tipo do documento ${document.title || document.file_name}`}
                                      >
                                        {clientDocumentTypes.map((type) => (
                                          <option key={type.value} value={type.value}>
                                            {type.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span
                                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${clientDocumentBadgeClass(
                                          currentType,
                                        )}`}
                                      >
                                        {formatClientDocumentType(currentType)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">
                                    <div className="font-medium text-slate-950">
                                      {displayValue(document.title)}
                                    </div>
                                    {document.description ? (
                                      <div className="mt-1 text-xs text-slate-500">
                                        {document.description}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">
                                    <span className="inline-flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-slate-400" />
                                      {document.file_name}
                                    </span>
                                  </td>
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
                                          Atualize a categoria, os textos ou selecione um novo arquivo
                                          para substituir o documento atual.
                                        </p>
                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                          <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                              Tipo
                                            </label>
                                            <select
                                              value={editingType}
                                              onChange={(event) =>
                                                setEditingType(
                                                  event.target.value as ClientDocumentType,
                                                )
                                              }
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
                                              Título
                                            </label>
                                            <input
                                              value={editingTitle}
                                              onChange={(event) =>
                                                setEditingTitle(event.target.value)
                                              }
                                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                                            />
                                          </div>
                                          <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                              Descrição
                                            </label>
                                            <textarea
                                              rows={3}
                                              value={editingDescription}
                                              onChange={(event) =>
                                                setEditingDescription(event.target.value)
                                              }
                                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                                            />
                                          </div>
                                          <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                              Substituir arquivo
                                            </label>
                                            <input
                                              type="file"
                                              onChange={(event) =>
                                                setReplacementFile(event.target.files?.[0] ?? null)
                                              }
                                              className="block w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600"
                                              accept={clientDocumentAcceptedInputTypes}
                                            />
                                            <p className="text-xs text-slate-500">
                                              Deixe em branco se quiser apenas editar as informações
                                              do documento atual.
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
                                            Salvar alterações
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
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 py-6 text-sm text-slate-500">
                      Nenhum documento encontrado em {group.label}.
                    </div>
                  )
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-950">
            Nenhum documento encontrado.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Os arquivos enviados aparecerão na categoria correspondente.
          </p>
        </div>
      )}
    </div>
  );
}
