import { preSaleStatuses, type PreSaleStatus } from "@/types/pre-sale";

const statusStyles: Record<PreSaleStatus, string> = {
  lead: "border-slate-200 bg-slate-50 text-slate-700",
  pre_venda: "border-cyan-200 bg-cyan-50 text-cyan-700",
  em_contato: "border-blue-200 bg-blue-50 text-blue-700",
  em_negociacao: "border-yellow-200 bg-yellow-50 text-yellow-800",
  aprovado: "border-teal-200 bg-teal-50 text-teal-700",
  perdido: "border-red-200 bg-red-50 text-red-700",
};

export function getPreSaleStatusLabel(status: PreSaleStatus) {
  return preSaleStatuses.find((item) => item.value === status)?.label ?? status;
}

export function PreSalesStatusBadge({ status }: { status: PreSaleStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles[status]}`}
    >
      {getPreSaleStatusLabel(status)}
    </span>
  );
}
