"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import { PreSaleDeleteButton } from "@/components/pre-sales/pre-sale-delete-button";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import {
  formatCurrency,
  formatPreSaleType,
  formatUserName,
} from "@/lib/pre-sales/formatters";
import {
  preSalePipelineStatuses,
  preSaleStatuses,
  type PreSaleStatus,
  type PreSaleWithRelations,
} from "@/types/pre-sale";
import { updatePreSaleStatusAction } from "@/app/(authenticated)/pre-vendas/actions";
import { PreSalesStatusBadge } from "./pre-sales-status-badge";

type PreSalesKanbanProps = {
  preSales: PreSaleWithRelations[];
  canDelete?: boolean;
};

export function PreSalesKanban({ preSales, canDelete = false }: PreSalesKanbanProps) {
  const router = useRouter();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PreSaleStatus | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    preSaleId: string;
    status: PreSaleStatus;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();

  function handleDrop(status: PreSaleStatus) {
    if (!draggedId) {
      return;
    }

    const draggedPreSale = preSales.find((preSale) => preSale.id === draggedId);

    if (!draggedPreSale || draggedPreSale.status === status) {
      setDraggedId(null);
      setDropTarget(null);
      return;
    }

    setMessage(null);
    setPendingStatusChange({
      preSaleId: draggedId,
      status,
    });
    setDraggedId(null);
    setDropTarget(null);
  }

  function confirmStatusChange(note: string) {
    if (!pendingStatusChange) {
      return;
    }

    startTransition(async () => {
      const result = await updatePreSaleStatusAction(
        pendingStatusChange.preSaleId,
        pendingStatusChange.status,
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
    setPendingStatusChange(null);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">Pipeline</h2>
        {isPending ? <p className="text-sm text-slate-500">Atualizando...</p> : null}
      </div>
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
      <div className="grid gap-4 overflow-x-auto lg:grid-cols-6">
        {(preSales.some((preSale) =>
          preSale.status === "inativo" || preSale.status === "distrato",
        )
          ? preSaleStatuses.filter((status) =>
              preSales.some((preSale) => preSale.status === status.value),
            )
          : preSalePipelineStatuses
        ).map((status) => {
          const columnPreSales = preSales.filter((preSale) => preSale.status === status.value);

          return (
            <div
              key={status.value}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId) {
                  setDropTarget(status.value);
                }
              }}
              onDragLeave={() => {
                if (dropTarget === status.value) {
                  setDropTarget(null);
                }
              }}
              onDrop={() => handleDrop(status.value)}
              className={`min-h-56 rounded-lg border p-3 transition ${
                dropTarget === status.value
                  ? "border-teal-400 bg-teal-50/60 ring-2 ring-teal-200"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <PreSalesStatusBadge status={status.value} />
                <span className="text-xs font-semibold text-slate-500">
                  {columnPreSales.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnPreSales.map((preSale) => (
                  <article
                    key={preSale.id}
                    draggable
                    onDragStart={() => setDraggedId(preSale.id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropTarget(null);
                    }}
                    className={`rounded-lg border bg-white p-3 shadow-sm transition ${
                      draggedId === preSale.id
                        ? "cursor-grabbing border-teal-300 opacity-70"
                        : "cursor-grab border-slate-200"
                    }`}
                  >
                    <Link
                      href={`/pre-vendas/${preSale.id}`}
                      className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                    >
                      {preSale.client?.full_name ?? "Cliente não encontrado"}
                    </Link>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {formatPreSaleType(preSale.pre_sale_type)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {preSale.service_type || "Serviço não informado"}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {formatCurrency(preSale.contract_value)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatUserName(preSale.consultant)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <WhatsAppLink
                        phone={preSale.client?.phone_mobile ?? null}
                        label="WhatsApp"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                      />
                      <Link
                        href={`/pre-vendas/${preSale.id}/editar`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Editar
                      </Link>
                      {canDelete ? (
                        <PreSaleDeleteButton
                          preSaleId={preSale.id}
                          variant="inline"
                          className="px-2.5 py-1.5 text-xs"
                        />
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ChangeNoteModal
        isOpen={Boolean(pendingStatusChange)}
        title="Registrar mudança de status"
        description="Explique o que aconteceu nessa movimentação da pré-venda e por que ela foi para esta nova etapa."
        confirmLabel="Mover com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStatusChange(null);
        }}
        onConfirm={confirmStatusChange}
      />
    </section>
  );
}
