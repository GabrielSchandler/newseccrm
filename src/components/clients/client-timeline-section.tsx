"use client";

import {
  FileText,
  FolderClock,
  History,
  MessageSquarePlus,
  PenSquare,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addClientTimelineNoteAction,
  deleteClientTimelineNoteAction,
  updateClientTimelineNoteAction,
} from "@/app/(authenticated)/clientes/actions";
import { formatDateTime } from "@/lib/clients/formatters";
import type { ClientTimelineEvent, ClientTimelineEventType } from "@/types/client-timeline";
import { formatCompanyBusinessArea, formatCompanyUserRole } from "@/types/user";

type ClientTimelineSectionProps = {
  clientId: string;
  events: ClientTimelineEvent[];
  currentUserProfileId: string;
  canEditOwnNotes: boolean;
  canManageAllNotes: boolean;
};

type TimelineEventConfig = {
  label: string;
  icon: typeof MessageSquarePlus;
  badgeClassName: string;
  iconClassName: string;
};

function getEventConfig(eventType: ClientTimelineEventType): TimelineEventConfig {
  switch (eventType) {
    case "client_created":
    case "client_updated":
      return {
        label: "Cliente",
        icon: PenSquare,
        badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
        iconClassName: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "pre_sale_created":
    case "pre_sale_updated":
    case "pre_sale_status_updated":
      return {
        label: "Pre-venda",
        icon: FolderClock,
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
        iconClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "legal_stage_updated":
      return {
        label: "Juridico",
        icon: ShieldCheck,
        badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
        iconClassName: "border-violet-200 bg-violet-50 text-violet-700",
      };
    case "client_document_uploaded":
    case "client_document_updated":
    case "client_document_replaced":
    case "client_document_deleted":
      return {
        label: "Documento",
        icon: FileText,
        badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
        iconClassName: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "email_draft_created":
    case "email_sent":
      return {
        label: "Email",
        icon: Mail,
        badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
        iconClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
      };
    case "tracking_update_created":
    case "tracking_update_updated":
    case "tracking_update_deleted":
      return {
        label: "Acompanhamento",
        icon: FolderClock,
        badgeClassName: "border-teal-200 bg-teal-50 text-teal-700",
        iconClassName: "border-teal-200 bg-teal-50 text-teal-700",
      };
    case "manual_note":
    default:
      return {
        label: "Anotacao",
        icon: MessageSquarePlus,
        badgeClassName: "border-teal-200 bg-teal-50 text-teal-700",
        iconClassName: "border-teal-200 bg-teal-50 text-teal-700",
      };
  }
}

function formatActorLine(event: ClientTimelineEvent) {
  const actorName = event.actor_name?.trim() || "Usuario nao identificado";
  const roleLabel = formatCompanyUserRole(event.actor_role);
  const shouldShowArea =
    event.actor_business_area &&
    (event.actor_role === "seller" || event.actor_role === "manager");

  if (shouldShowArea) {
    return `${roleLabel} (${formatCompanyBusinessArea(event.actor_business_area)}) • ${actorName}`;
  }

  return `${roleLabel} • ${actorName}`;
}

function getDetailLines(event: ClientTimelineEvent) {
  const details = (event.details ?? {}) as Record<string, unknown>;
  const lines: string[] = [];

  if (Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
    lines.push(`Campos mexidos: ${details.changed_fields.join(", ")}`);
  }

  if (typeof details.previous_status === "string" && typeof details.next_status === "string") {
    lines.push(`Status: ${details.previous_status} -> ${details.next_status}`);
  }

  if (typeof details.previous_stage === "string" && typeof details.next_stage === "string") {
    lines.push(`Etapa juridica: ${details.previous_stage} -> ${details.next_stage}`);
  }

  if (typeof details.note_edited_at === "string") {
    lines.push(`Anotacao editada em: ${formatDateTime(details.note_edited_at)}`);
  }

  return lines;
}

export function ClientTimelineSection({
  clientId,
  events,
  currentUserProfileId,
  canEditOwnNotes,
  canManageAllNotes,
}: ClientTimelineSectionProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedEvents = useMemo(() => events, [events]);

  function handleSubmitNote() {
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setFeedback({
        ok: false,
        message: "Escreva uma anotacao antes de enviar para a linha do tempo.",
      });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await addClientTimelineNoteAction(clientId, trimmedNote);
      setFeedback(result);

      if (result.ok) {
        setNote("");
        router.refresh();
      }
    });
  }

  function beginEditing(event: ClientTimelineEvent) {
    setEditingEventId(event.id);
    setEditingNote(event.note ?? "");
    setFeedback(null);
  }

  function cancelEditing() {
    setEditingEventId(null);
    setEditingNote("");
  }

  function handleUpdateNote(eventId: string) {
    const trimmedNote = editingNote.trim();

    if (!trimmedNote) {
      setFeedback({
        ok: false,
        message: "Escreva uma anotacao antes de salvar.",
      });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await updateClientTimelineNoteAction(eventId, trimmedNote);
      setFeedback(result);

      if (result.ok) {
        cancelEditing();
        router.refresh();
      }
    });
  }

  function handleDeleteNote(event: ClientTimelineEvent) {
    const confirmed = window.confirm(
      "Remover esta anotacao da linha do tempo? Esta acao nao pode ser desfeita.",
    );

    if (!confirmed) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await deleteClientTimelineNoteAction(event.id);
      setFeedback(result);

      if (result.ok) {
        if (editingEventId === event.id) {
          cancelEditing();
        }
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Linha do tempo do cliente</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Tudo o que foi feito com este cliente fica registrado aqui, com ordem do mais novo para o mais antigo.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
          <History className="h-4 w-4" />
          Historico centralizado
        </div>
      </div>

      <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-teal-200 bg-white p-2 text-teal-700">
            <MessageSquarePlus className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Nova anotacao</p>
              <p className="mt-1 text-sm text-slate-600">
                Use este campo para registrar tratativas, combinados, pendencias e qualquer contexto importante do atendimento.
              </p>
            </div>
            <textarea
              rows={4}
              value={note}
              disabled={isPending}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: Cliente enviou documento complementar e pediu retorno ainda hoje. Pendencia repassada ao juridico."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmitNote}
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Salvando..." : "Adicionar anotacao"}
              </button>
              {feedback ? (
                <p className={`text-sm ${feedback.ok ? "text-teal-800" : "text-red-700"}`}>
                  {feedback.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {orderedEvents.length ? (
        <div className="relative space-y-4 before:absolute before:bottom-0 before:left-[22px] before:top-0 before:w-px before:bg-slate-200">
          {orderedEvents.map((event) => {
            const config = getEventConfig(event.event_type);
            const Icon = config.icon;
            const detailLines = getDetailLines(event);
            const canManageThisNote =
              Boolean(event.note?.trim()) &&
              (canManageAllNotes ||
                (canEditOwnNotes && event.actor_user_profile_id === currentUserProfileId));
            const isEditing = editingEventId === event.id;

            return (
              <article key={event.id} className="relative pl-14">
                <div
                  className={`absolute left-0 top-1 flex h-11 w-11 items-center justify-center rounded-full border ${config.iconClassName}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${config.badgeClassName}`}
                      >
                        {config.label}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-950">{event.title}</h3>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{formatDateTime(event.created_at)}</p>
                  </div>

                  {event.note && !isEditing ? (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {event.note}
                    </p>
                  ) : null}

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        rows={4}
                        value={editingNote}
                        disabled={isPending}
                        onChange={(inputEvent) => setEditingNote(inputEvent.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdateNote(event.id)}
                          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isPending ? "Salvando..." : "Salvar anotacao"}
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
                  ) : null}

                  {detailLines.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailLines.map((line) => (
                        <span
                          key={line}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatActorLine(event)}
                  </p>

                  {canManageThisNote && !isEditing ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => beginEditing(event)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Editar anotacao
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteNote(event)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Remover anotacao
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Ainda nao ha movimentacoes registradas nesta linha do tempo.
        </div>
      )}
    </section>
  );
}
