"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import {
  formatCurrency,
  formatPreSaleType,
  formatUserName,
} from "@/lib/pre-sales/formatters";
import { preSaleStatuses, type PreSaleStatus, type PreSaleWithRelations } from "@/types/pre-sale";
import { updatePreSaleStatusAction } from "@/app/(authenticated)/pre-vendas/actions";
import { PreSalesStatusBadge } from "./pre-sales-status-badge";

type PreSalesKanbanProps = {
  preSales: PreSaleWithRelations[];
};

export function PreSalesKanban({ preSales }: PreSalesKanbanProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDrop(status: PreSaleStatus) {
    if (!draggedId) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await updatePreSaleStatusAction(draggedId, status);

      if (!result.ok) {
        setMessage(result.message);
      } else {
        setMessage(result.message);
      }
    });
    setDraggedId(null);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">Pipeline</h2>
        {isPending ? <p className="text-sm text-slate-500">Atualizando...</p> : null}
      </div>
      {message ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </div>
      ) : null}
      <div className="grid gap-4 overflow-x-auto lg:grid-cols-6">
        {preSaleStatuses.map((status) => {
          const columnPreSales = preSales.filter((preSale) => preSale.status === status.value);

          return (
            <div
              key={status.value}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(status.value)}
              className="min-h-56 rounded-lg border border-slate-200 bg-slate-50 p-3"
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
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <Link
                      href={`/pre-vendas/${preSale.id}`}
                      className="text-sm font-semibold text-slate-950 hover:text-teal-700"
                    >
                      {preSale.client?.full_name ?? "Cliente nao encontrado"}
                    </Link>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {formatPreSaleType(preSale.pre_sale_type)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {preSale.service_type || "Servico nao informado"}
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
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
