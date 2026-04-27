import Link from "next/link";
import { CalculationStatusBadge } from "@/components/calculations/calculation-status-badge";
import {
  formatCalculationCurrency,
  formatCalculationDateTime,
} from "@/lib/calculations/formatters";
import { listClientCalculations } from "@/lib/calculations/service";

export async function ClientCalculationsSection({ clientId }: { clientId: string }) {
  const calculations = await listClientCalculations(clientId);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Calculos do cliente
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Consulte os calculos revisionais vinculados a este cliente.
          </p>
        </div>
        <Link
          href={`/calculos/novo?clientId=${clientId}`}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Novo calculo
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Financeira</th>
              <th className="px-4 py-3 font-semibold">Valor financiado</th>
              <th className="px-4 py-3 font-semibold">Economia estimada</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {calculations.map((calculation) => (
              <tr key={calculation.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">
                  {calculation.financer_name ?? "Nao informado"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatCalculationCurrency(calculation.financed_value)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatCalculationCurrency(calculation.estimated_savings)}
                </td>
                <td className="px-4 py-3">
                  <CalculationStatusBadge status={calculation.status} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatCalculationDateTime(calculation.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/calculos/${calculation.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {!calculations.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  Nenhum calculo encontrado para este cliente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
