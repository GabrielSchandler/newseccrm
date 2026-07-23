"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  cancelClientDocumentsBulkUploadAction,
  completeClientDocumentsBulkUploadAction,
  prepareClientDocumentsBulkUploadAction,
  type ClientDocumentActionState,
} from "@/app/(authenticated)/clientes/document-actions";
import { FormFieldLabel } from "@/components/form-field-label";
import { createClient } from "@/lib/supabase/browser";
import {
  clientDocumentAcceptedFormatsLabel,
  clientDocumentAcceptedInputTypes,
  clientDocumentTypes,
  type ClientDocumentType,
} from "@/types/client-document";

type ClientDocumentUploadProps = {
  clientId: string;
  preSaleId?: string | null;
  fixedDocumentType?: ClientDocumentType;
};

function getFriendlyUploadError(message: string) {
  if (message.toLowerCase().includes("exceeded the maximum allowed size")) {
    return "Um dos arquivos ultrapassa o limite permitido pelo Storage. O limite atual para documentos do cliente e 20 MB por arquivo.";
  }

  return message;
}

const defaultDocumentType = clientDocumentTypes[0]?.value ?? "documentacao";

export function ClientDocumentUpload({
  clientId,
  preSaleId = null,
  fixedDocumentType,
}: ClientDocumentUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState(fixedDocumentType ?? defaultDocumentType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<ClientDocumentActionState | null>(null);
  const disabled = isPending || files.length === 0;
  const selectedDocumentType = fixedDocumentType ?? documentType;
  const selectedDocumentTypeLabel =
    clientDocumentTypes.find((item) => item.value === selectedDocumentType)?.label ??
    "Documentação";
  const hintText = useMemo(
    () =>
      preSaleId
        ? "Este arquivo será vinculado ao cliente e também a esta operação."
        : "Este arquivo será vinculado ao cliente.",
    [preSaleId],
  );

  function resetForm() {
    setFiles([]);
    setDocumentType(fixedDocumentType ?? defaultDocumentType);
    setTitle("");
    setDescription("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!files.length) {
      setState({
        ok: false,
        message: "Selecione pelo menos um arquivo.",
      });
      return;
    }

    setState(null);

    startTransition(async () => {
      const payload = {
        client_id: clientId,
        pre_sale_id: preSaleId ?? "",
        document_type: selectedDocumentType,
        title,
        description,
      };
      const prepared = await prepareClientDocumentsBulkUploadAction(
        payload,
        files.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      );

      if (!prepared.ok || !prepared.uploads?.length) {
        setState(prepared);
        return;
      }

      const supabase = createClient();
      const uploadedPaths: string[] = [];

      for (const upload of prepared.uploads) {
        const file = files[upload.index];

        if (!file) {
          await cancelClientDocumentsBulkUploadAction(uploadedPaths);
          setState({
            ok: false,
            message: "Um arquivo selecionado não foi encontrado. Selecione novamente.",
          });
          return;
        }

        const { error } = await supabase.storage
          .from("client-documents")
          .uploadToSignedUrl(upload.filePath, upload.token, file, {
            contentType: upload.mimeType || file.type || "application/octet-stream",
          });

        if (error) {
          await cancelClientDocumentsBulkUploadAction(uploadedPaths);
          setState({
            ok: false,
            message: getFriendlyUploadError(error.message),
          });
          return;
        }

        uploadedPaths.push(upload.filePath);
      }

      const result = await completeClientDocumentsBulkUploadAction(
        {
          ...payload,
        },
        prepared.uploads,
      );
      setState(result);

      if (result.ok) {
        resetForm();
        const fileInput = globalThis.document.getElementById(
          `client-document-file-${preSaleId ?? "client"}-${selectedDocumentType}`,
        ) as HTMLInputElement | null;

        if (fileInput) {
          fileInput.value = "";
        }

        router.refresh();
      }
    });
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-950">Adicionar documento em massa</h3>
        <p className="mt-1 text-sm text-slate-600">{hintText}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {fixedDocumentType ? (
          <div className="space-y-2">
            <FormFieldLabel label="Tipo do documento" requirement="required" />
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
              {selectedDocumentTypeLabel}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <FormFieldLabel
              htmlFor="document_type"
              label="Tipo do documento"
              requirement="required"
            />
            <select
              id="document_type"
              value={documentType}
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              onChange={(event) =>
                setDocumentType(event.target.value as (typeof clientDocumentTypes)[number]["value"])
              }
            >
              {clientDocumentTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <FormFieldLabel
            htmlFor={`client-document-file-${preSaleId ?? "client"}-${selectedDocumentType}`}
            label="Arquivo"
            requirement="required"
          />
          <input
            id={`client-document-file-${preSaleId ?? "client"}-${selectedDocumentType}`}
            type="file"
            multiple
            disabled={isPending}
            accept={clientDocumentAcceptedInputTypes}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          {files.length ? (
            <p className="text-xs text-slate-500">
              {files.length} arquivo(s) selecionado(s).
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="title" label="Título" requirement="optional" />
          <input
            id="title"
            value={title}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            placeholder="Opcional para envio único. Em massa, o nome do arquivo vira título."
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="description"
            label="Descrição"
            requirement="optional"
          />
          <input
            id="description"
            value={description}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            placeholder="Observação opcional"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Formatos aceitos: {clientDocumentAcceptedFormatsLabel}. Tamanho maximo: 20 MB.
      </p>

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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Enviando..." : files.length > 1 ? "Enviar documentos" : "Enviar documento"}
        </button>
      </div>
    </form>
  );
}
