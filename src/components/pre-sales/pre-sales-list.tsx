"use client";

import { Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import { PreSaleDeleteButton } from "@/components/pre-sales/pre-sale-delete-button";
import { ChangeNoteModal } from "@/components/shared/change-note-modal";
import { displayCpf } from "@/lib/clients/formatters";
import {
  formatCurrency,
  formatPreSaleType,
  formatUserName,
} from "@/lib/pre-sales/formatters";
import { preSaleStatuses, type PreSaleStatus, type PreSaleWithRelations } from "@/types/pre-sale";
import { updatePreSaleStatusAction } from "@/app/(authenticated)/pre-vendas/actions";
import { PreSalesStatusBadge } from "./pre-sales-status-badge";

type PreSalesListProps = {
  preSales: PreSaleWithRelations[];
  canDelete?: boolean;
};

export function PreSalesList({ preSales, canDelete = false }: PreSalesListProps) {
  const router = useRouter();
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    preSaleId: string;
    status: PreSaleStatus;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!preSales.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">
          Nenhuma pre-venda encontrada
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Crie uma nova oportunidade ou ajuste os filtros.
        </p>
      </div>
    );
  }

  function confirmStatusChange(note: string) {
    if (!pendingStatusChange) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await updatePreSaleStatusAction(
        pendingStatusChange.preSaleId,
        pendingStatusChange.status,
        note,
      );

      if (!result.ok) {
        setMessage(result.message);
        setPendingStatusChange(null);
        return;
      }

      setPendingStatusChange(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Cliente</th>
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Servico</th>
              <th className="px-5 py-3 font-semibold">Valor do contrato</th>
              <th className="px-5 py-3 font-semibold">Responsavel</th>
              <th className="px-5 py-3 font-semibold">Data de abertura</th>
              <th className="px-5 py-3 text-right font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preSales.map((preSale) => (
              <tr
                key={preSale.id}
                onClick={() => router.push(`/pre-vendas/${preSale.id}`)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-950">
                    {preSale.client?.full_name ?? "Cliente nao encontrado"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {displayCpf(preSale.client?.cpf ?? null)}
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {formatPreSaleType(preSale.pre_sale_type)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <PreSalesStatusBadge status={preSale.status} />
                    <select
                      value={preSale.status}
                      disabled={isPending}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        setPendingStatusChange({
                          preSaleId: preSale.id,
                          status: event.target.value as PreSaleStatus,
                        });
                      }}
                    >
                      {preSaleStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {preSale.service_type || "-"}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {formatCurrency(preSale.contract_value)}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {formatUserName(preSale.consultant)}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {new Intl.DateTimeFormat("pt-BR").format(new Date(preSale.created_at))}
                </td>
                <td className="px-5 py-4">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <WhatsAppLink
                      phone={preSale.client?.phone_mobile ?? null}
                      label="WhatsApp"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                    />
                    {preSale.client ? (
                      <Link
                        href={`/clientes/${preSale.client.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Cliente
                      </Link>
                    ) : null}
                    <Link
                      href={`/pre-vendas/${preSale.id}/editar`}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                    {canDelete ? (
                      <PreSaleDeleteButton preSaleId={preSale.id} variant="inline" />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      <ChangeNoteModal
        isOpen={Boolean(pendingStatusChange)}
        title="Registrar mudanca de status"
        description="Explique o que aconteceu nessa movimentacao da pre-venda e por que ela foi para este novo status."
        confirmLabel="Alterar com anotacao"
        pending={isPending}
        onClose={() => {
          if (isPending) {
            return;
          }

          setPendingStatusChange(null);
        }}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
