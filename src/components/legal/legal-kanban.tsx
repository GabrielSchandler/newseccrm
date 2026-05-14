"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateLegalWorkflowStageAction } from "@/app/(authenticated)/juridico/actions";
import { GenerateDocumentModal } from "@/components/documents/generate-document-modal";
import { LegalStageSelect } from "@/components/legal/legal-stage-select";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import {
  displayValue,
  formatDate,
  formatDateTime,
} from "@/lib/clients/formatters";
import {
  getLegalWorkflowStage,
  legalWorkflowStages,
  type LegalWorkflowStage,
} from "@/lib/legal/workflow";
import { formatCurrency, formatUserName } from "@/lib/pre-sales/formatters";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import type { ClientOption, PreSale, UserProfileOption } from "@/types/pre-sale";

export type LegalBoardPreSale = PreSale & {
  client: Pick<ClientOption, "id" | "full_name"> | null;
  consultant: UserProfileOption | null;
  legalResponsibleUserId: string | null;
  legalConsultantUserId: string | null;
  currentLegalStage: LegalWorkflowStage;
  stageUpdatedAt: string;
  generatedDocuments: GeneratedDocument[];
};

type LegalKanbanProps = {
  preSales: LegalBoardPreSale[];
  templates: DocumentTemplate[];
  legalAdmins: UserProfileOption[];
  legalConsultants: UserProfileOption[];
  currentUserId: string;
};

function getStageAgeLabel(isoDate: string) {
  const stageDate = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - stageDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return "Entrou hoje";
  }

  if (diffDays === 1) {
    return "Ha 1 dia";
  }

  return `Ha ${diffDays} dias`;
}

function getStageTemplates(
  templates: DocumentTemplate[],
  stage: LegalWorkflowStage,
) {
  const explicitMatches = templates.filter((template) => template.legal_stage === stage);

  if (explicitMatches.length) {
    return explicitMatches;
  }

  const normalize = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const stageKeywords: Record<LegalWorkflowStage, string[]> = {
    termo_pagamento_servico: ["recibo", "termo de pagamento", "prestacao de servico"],
    lgpd_hipossuficiencia_procuracao: ["lgpd", "hipossuficiencia", "procuracao"],
    diligencia_cobranca: ["notificacao", "protocolo", "designacao de perito", "perito"],
    pagamento_laudo: ["pagamento de laudo", "laudo"],
    pos_laudo_ciencia: ["ciencia e responsabilidade", "termo de ciencia", "concordancia"],
  };

  const keywords = stageKeywords[stage];

  return templates.filter((template) => {
    const haystack = `${normalize(template.name)} ${normalize(template.description)}`;
    return keywords.some((keyword) => haystack.includes(normalize(keyword)));
  });
}

function getPreSaleStageDocuments(
  generatedDocuments: GeneratedDocument[],
  stageTemplates: DocumentTemplate[],
) {
  const stageTemplateIds = new Set(stageTemplates.map((template) => template.id));
  return generatedDocuments.filter((document) => stageTemplateIds.has(document.template_id));
}

export function LegalKanban({
  preSales,
  templates,
  legalAdmins,
  legalConsultants,
  currentUserId,
}: LegalKanbanProps) {
  const router = useRouter();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LegalWorkflowStage | null>(null);
  const [pendingStageChange, setPendingStageChange] = useState<{
    preSaleId: string;
    stage: LegalWorkflowStage;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();
  const [adminFilter, setAdminFilter] = useState<string>(() =>
    legalAdmins.some((admin) => admin.id === currentUserId) &&
    preSales.some((preSale) => preSale.legalResponsibleUserId === currentUserId)
      ? currentUserId
      : "all",
  );
  const [consultantFilter, setConsultantFilter] = useState<string>(() =>
    legalConsultants.some((consultant) => consultant.id === currentUserId) &&
    preSales.some((preSale) => preSale.legalConsultantUserId === currentUserId)
      ? currentUserId
      : "all",
  );

  const stageTemplatesMap = useMemo(() => {
    return Object.fromEntries(
      legalWorkflowStages.map((stage) => [stage.value, getStageTemplates(templates, stage.value)]),
    ) as Record<LegalWorkflowStage, DocumentTemplate[]>;
  }, [templates]);

  const filteredPreSales = useMemo(() => {
    return preSales.filter((preSale) => {
      const matchesAdmin =
        adminFilter === "all"
          ? true
          : adminFilter === "none"
            ? !preSale.legalResponsibleUserId
            : preSale.legalResponsibleUserId === adminFilter;
      const matchesConsultant =
        consultantFilter === "all"
          ? true
          : consultantFilter === "none"
            ? !preSale.legalConsultantUserId
            : preSale.legalConsultantUserId === consultantFilter;

      return matchesAdmin && matchesConsultant;
    });
  }, [adminFilter, consultantFilter, preSales]);

  function handleDrop(stage: LegalWorkflowStage) {
    if (!draggedId) {
      return;
    }

    const draggedPreSale = preSales.find((preSale) => preSale.id === draggedId);

    if (!draggedPreSale || draggedPreSale.currentLegalStage === stage) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    setMessage(null);
    setPendingStageChange({
      preSaleId: draggedId,
      stage,
    });
    setDraggedId(null);
    setDropTarget(null);
  }

  function confirmStageChange(note: string) {
    if (!pendingStageChange) {
      return;
    }

    startTransition(async () => {
      const result = await updateLegalWorkflowStageAction(
        pendingStageChange.preSaleId,
        pendingStageChange.stage,
        note,
      );

      if (!result.ok) {
        setMessageTone("error");
        setMessage(result.message);
      } else {
        setMessageTone("success");
        setMessage(result.message);
        router.refresh();
      }
    });
    setPendingStageChange(null);
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            messageTone === "success"
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="md:col-span-3 xl:col-span-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Filtros de responsaveis juridicos
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  A esteira abre filtrada para o responsavel logado quando houver vinculo. Se precisar, voce pode trocar para outro responsavel, ver todos ou localizar clientes sem responsavel definido.
                </p>
              </div>
              <div className="grid w-full gap-3 md:max-w-2xl md:grid-cols-2">
                <div>
                  <label
                    htmlFor="legal-admin-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Adm responsavel
                  </label>
                  <select
                    id="legal-admin-filter"
                    value={adminFilter}
                    onChange={(event) => setAdminFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  >
                    <option value="all">Todos</option>
                    <option value="none">Sem adm responsavel</option>
                    {legalAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {formatUserName(admin)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="legal-consultant-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Consultor responsavel
                  </label>
                  <select
                    id="legal-consultant-filter"
                    value={consultantFilter}
                    onChange={(event) => setConsultantFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                  >
                    <option value="all">Todos</option>
                    <option value="none">Sem consultor responsavel</option>
                    {legalConsultants.map((consultant) => (
                      <option key={consultant.id} value={consultant.id}>
                        {formatUserName(consultant)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        {legalWorkflowStages.map((stage) => {
          const total = filteredPreSales.filter(
            (preSale) => preSale.currentLegalStage === stage.value,
          ).length;

          return (
            <div
              key={stage.value}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {stage.shortLabel}
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{total}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {stage.documents.join(", ")}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {legalWorkflowStages.map((stage) => {
          const stageTemplates = stageTemplatesMap[stage.value];
          const stagePreSales = filteredPreSales.filter(
            (preSale) => preSale.currentLegalStage === stage.value,
          );

          return (
            <div
              key={stage.value}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId) {
                  setDropTarget(stage.value);
                }
              }}
              onDragLeave={() => {
                if (dropTarget === stage.value) {
                  setDropTarget(null);
                }
              }}
              onDrop={() => handleDrop(stage.value)}
              className={`flex min-h-[520px] flex-col rounded-lg border shadow-sm transition ${
                dropTarget === stage.value
                  ? "border-teal-400 bg-teal-50/50 ring-2 ring-teal-200"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="border-b border-slate-200 px-4 py-4">
                <h2 className="text-sm font-semibold text-slate-950">{stage.label}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {stage.description}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Templates esperados: {stage.documents.join(" | ")}
                </p>
              </div>

              <div className="flex-1 space-y-3 p-4">
                {stagePreSales.length ? (
                  stagePreSales.map((preSale) => {
                    const stageMeta = getLegalWorkflowStage(preSale.currentLegalStage);
                    const stageDocuments = getPreSaleStageDocuments(
                      preSale.generatedDocuments,
                      stageTemplates,
                    );

                    return (
                      <article
                        key={preSale.id}
                        draggable
                        onDragStart={() => setDraggedId(preSale.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDropTarget(null);
                        }}
                        className={`rounded-lg border p-4 transition ${
                          draggedId === preSale.id
                            ? "cursor-grabbing border-teal-300 bg-white opacity-70"
                            : "cursor-grab border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">
                              {displayValue(preSale.client?.full_name ?? null)}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {stageMeta.shortLabel} • {getStageAgeLabel(preSale.stageUpdatedAt)}
                            </p>
                          </div>
                          <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                            {stageDocuments.length} docs
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-xs text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-700">Consultor:</span>{" "}
                            {formatUserName(preSale.consultant)}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Adm responsavel:</span>{" "}
                            {formatUserName(
                              legalAdmins.find(
                                (admin) => admin.id === preSale.legalResponsibleUserId,
                              ) ?? null,
                            )}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Consultor responsavel:</span>{" "}
                            {formatUserName(
                              legalConsultants.find(
                                (consultant) => consultant.id === preSale.legalConsultantUserId,
                              ) ?? null,
                            )}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Valor:</span>{" "}
                            {formatCurrency(preSale.contract_value)}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Aprovado em:</span>{" "}
                            {formatDateTime(preSale.created_at)}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Ultima mudanca:</span>{" "}
                            {formatDate(preSale.stageUpdatedAt)}
                          </p>
                        </div>

                        <div className="mt-4">
                          <LegalStageSelect
                            preSaleId={preSale.id}
                            currentStage={preSale.currentLegalStage}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/clientes/${preSale.client_id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Cliente
                          </Link>
                          <Link
                            href={`/pre-vendas/${preSale.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Pre-venda
                          </Link>
                          <Link
                            href="/documentos"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Documentos
                          </Link>
                        </div>

                        <div className="mt-4">
                          <GenerateDocumentModal
                            preSaleId={preSale.id}
                            templates={stageTemplates}
                          />
                        </div>

                        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Documentos desta etapa
                          </p>
                          {stageTemplates.length ? (
                            <ul className="space-y-2 text-xs text-slate-700">
                              {stageTemplates.map((template) => {
                                const documentCreated = stageDocuments.find(
                                  (document) => document.template_id === template.id,
                                );

                                return (
                                  <li
                                    key={template.id}
                                    className="flex items-start justify-between gap-3"
                                  >
                                    <div>
                                      <p className="font-medium text-slate-800">
                                        {template.name}
                                      </p>
                                      <p className="text-slate-500">
                                        {documentCreated
                                          ? `Gerado em ${formatDateTime(documentCreated.created_at)}`
                                          : "Ainda nao gerado"}
                                      </p>
                                    </div>
                                    {documentCreated ? (
                                      <Link
                                        href={`/documentos/gerados/${documentCreated.id}`}
                                        className="font-semibold text-teal-700 transition hover:text-teal-800"
                                      >
                                        Abrir
                                      </Link>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs leading-5 text-amber-700">
                              Nenhum template desta etapa foi vinculado ainda. Suba os
                              documentos prontos em Templates e marque a etapa juridica
                              correspondente.
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhum cliente nesta etapa.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {isPending ? <p className="text-sm text-slate-500">Movendo cliente...</p> : null}

      <ChangeNoteModal
        isOpen={Boolean(pendingStageChange)}
        title="Registrar mudanca na esteira juridica"
        description="Antes de mover o cliente de etapa, registre o que foi feito e por que essa movimentacao juridica aconteceu agora."
        confirmLabel="Mover com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStageChange(null);
        }}
        onConfirm={confirmStageChange}
      />
    </div>
  );
}
