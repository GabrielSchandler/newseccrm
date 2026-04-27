"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  uploadClientDocumentAction,
  type ClientDocumentActionState,
} from "@/app/(authenticated)/clientes/document-actions";
import { clientDocumentTypes } from "@/types/client-document";

type ClientDocumentUploadProps = {
  clientId: string;
  preSaleId?: string | null;
};

export function ClientDocumentUpload({
  clientId,
  preSaleId = null,
}: ClientDocumentUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(clientDocumentTypes[0]?.value ?? "rg");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<ClientDocumentActionState | null>(null);
  const disabled = isPending || !file;
  const hintText = useMemo(
    () =>
      preSaleId
        ? "Este arquivo sera vinculado ao cliente e tambem a esta operacao."
        : "Este arquivo sera vinculado ao cliente.",
    [preSaleId],
  );

  function resetForm() {
    setFile(null);
    setDocumentType(clientDocumentTypes[0]?.value ?? "rg");
    setTitle("");
    setDescription("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setState({
        ok: false,
        message: "Selecione um arquivo.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setState(null);

    startTransition(async () => {
      const result = await uploadClientDocumentAction(
        {
          client_id: clientId,
          pre_sale_id: preSaleId ?? "",
          document_type: documentType,
          title,
          description,
        },
        formData,
      );
      setState(result);

      if (result.ok) {
        resetForm();
        const fileInput = globalThis.document.getElementById(
          `client-document-file-${preSaleId ?? "client"}`,
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
        <h3 className="text-sm font-semibold text-slate-950">Adicionar documento</h3>
        <p className="mt-1 text-sm text-slate-600">{hintText}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="document_type">
            Tipo do documento
          </label>
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

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="document_file">
            Arquivo
          </label>
          <input
            id={`client-document-file-${preSaleId ?? "client"}`}
            type="file"
            disabled={isPending}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="title">
            Titulo
          </label>
          <input
            id="title"
            value={title}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            placeholder="Ex.: RG frente"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="description">
            Descricao
          </label>
          <input
            id="description"
            value={description}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            placeholder="Observacao opcional"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Formatos aceitos: PDF, JPG, PNG, WEBP, DOC e DOCX. Tamanho maximo: 10 MB.
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
          {isPending ? "Enviando..." : "Enviar documento"}
        </button>
      </div>
    </form>
  );
}
