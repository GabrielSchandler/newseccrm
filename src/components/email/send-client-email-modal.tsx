"use client";

import { Mail } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendClientEmailAction,
  type EmailActionState,
} from "@/app/(authenticated)/emails/actions";
import { formatClientDocumentSize } from "@/lib/client-documents/formatters";
import { displayValue } from "@/lib/clients/formatters";
import {
  emailDispatchModes,
  formatEmailRecipientMode,
  type EmailDispatchMode,
  type EmailTemplate,
} from "@/types/email";

export type EmailAttachmentOption = {
  id: string;
  title: string | null;
  file_name: string;
  file_size: number;
};

type SendClientEmailModalProps = {
  clientId: string;
  preSaleId?: string | null;
  clientEmail: string | null;
  bankName?: string | null;
  bankEmail?: string | null;
  templates: EmailTemplate[];
  documents: EmailAttachmentOption[];
  variables: Record<string, string>;
};

function renderTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    return variables[key] ?? "Nao informado";
  });
}

function recipientValue(template: EmailTemplate | null, clientEmail: string | null, bankEmail: string) {
  if (!template) {
    return clientEmail ?? "";
  }

  const recipients = [];

  if ((template.recipient_mode === "client" || template.recipient_mode === "client_bank") && clientEmail) {
    recipients.push(clientEmail);
  }

  if ((template.recipient_mode === "bank" || template.recipient_mode === "client_bank") && bankEmail) {
    recipients.push(bankEmail);
  }

  return recipients.join(", ");
}

export function SendClientEmailModal({
  clientId,
  preSaleId = null,
  clientEmail,
  bankName = null,
  bankEmail = null,
  templates,
  documents,
  variables,
}: SendClientEmailModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<EmailActionState | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [mode, setMode] = useState<EmailDispatchMode>("draft");
  const [typedBankEmail, setTypedBankEmail] = useState(bankEmail ?? "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const [to, setTo] = useState(() =>
    recipientValue(templates[0] ?? null, clientEmail, bankEmail ?? ""),
  );
  const [cc, setCc] = useState(templates[0]?.cc_template ?? "");
  const [bcc, setBcc] = useState(templates[0]?.bcc_template ?? "");
  const subjectPreview = selectedTemplate
    ? renderTemplate(selectedTemplate.subject_template, variables)
    : "";
  const bodyPreview = selectedTemplate
    ? renderTemplate(selectedTemplate.body_template, variables)
    : "";

  function handleTemplateChange(templateId: string) {
    const nextTemplate = templates.find((template) => template.id === templateId) ?? null;
    setSelectedTemplateId(templateId);
    setTo(recipientValue(nextTemplate, clientEmail, typedBankEmail));
    setCc(nextTemplate?.cc_template ?? "");
    setBcc(nextTemplate?.bcc_template ?? "");
  }

  function handleBankEmailChange(value: string) {
    setTypedBankEmail(value);

    if (
      selectedTemplate?.recipient_mode === "bank" ||
      selectedTemplate?.recipient_mode === "client_bank"
    ) {
      setTo(recipientValue(selectedTemplate, clientEmail, value));
    }
  }

  function toggleAttachment(documentId: string) {
    setSelectedAttachmentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  }

  function handleSend() {
    if (!selectedTemplateId) {
      setState({
        ok: false,
        message: "Cadastre e selecione um template de email.",
      });
      return;
    }

    setState(null);
    startTransition(async () => {
      const result = await sendClientEmailAction({
        client_id: clientId,
        pre_sale_id: preSaleId ?? "",
        template_id: selectedTemplateId,
        mode,
        to,
        cc,
        bcc,
        attachment_ids: selectedAttachmentIds,
      });
      setState(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
      >
        <Mail className="h-4 w-4" />
        Enviar email
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Enviar email</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selecione o template, confira os destinatarios e marque os anexos do cadastro do cliente.
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="email-template" className="text-sm font-semibold text-slate-700">
                    Template
                  </label>
                  <select
                    id="email-template"
                    value={selectedTemplateId}
                    disabled={isPending}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  >
                    {!templates.length ? <option value="">Nenhum template cadastrado</option> : null}
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {formatEmailRecipientMode(template.recipient_mode)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email-mode" className="text-sm font-semibold text-slate-700">
                    Acao
                  </label>
                  <select
                    id="email-mode"
                    value={mode}
                    disabled={isPending}
                    onChange={(event) => setMode(event.target.value as EmailDispatchMode)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  >
                    {emailDispatchModes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="bank-email" className="text-sm font-semibold text-slate-700">
                    Email do banco
                  </label>
                  <input
                    id="bank-email"
                    value={typedBankEmail}
                    disabled={isPending}
                    onChange={(event) => handleBankEmailChange(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                    placeholder={`Opcional${bankName ? ` para ${bankName}` : ""}`}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="email-to" className="text-sm font-semibold text-slate-700">
                    Para
                  </label>
                  <input
                    id="email-to"
                    value={to}
                    disabled={isPending}
                    onChange={(event) => setTo(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                    placeholder="email@exemplo.com.br"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email-cc" className="text-sm font-semibold text-slate-700">
                    Cc
                  </label>
                  <input
                    id="email-cc"
                    value={cc}
                    disabled={isPending}
                    onChange={(event) => setCc(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email-bcc" className="text-sm font-semibold text-slate-700">
                    Cco
                  </label>
                  <input
                    id="email-bcc"
                    value={bcc}
                    disabled={isPending}
                    onChange={(event) => setBcc(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Previa
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {displayValue(subjectPreview)}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {displayValue(bodyPreview)}
                </p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  A assinatura GRS sera adicionada automaticamente no final do email.
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">Anexos do cliente</p>
                <p className="mt-1 text-xs text-slate-500">
                  Nesta versao, os anexos selecionados precisam somar ate 3 MB.
                </p>
                <div className="mt-4 grid gap-2">
                  {documents.length ? (
                    documents.map((document) => (
                      <label
                        key={document.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAttachmentIds.includes(document.id)}
                          disabled={isPending}
                          onChange={() => toggleAttachment(document.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                        <span>
                          <span className="block font-semibold text-slate-950">
                            {document.title || document.file_name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {document.file_name} - {formatClientDocumentSize(document.file_size)}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Nenhum documento anexado no cadastro do cliente.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending || !selectedTemplateId}
                onClick={handleSend}
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Processando..." : mode === "draft" ? "Criar rascunho" : "Enviar agora"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
