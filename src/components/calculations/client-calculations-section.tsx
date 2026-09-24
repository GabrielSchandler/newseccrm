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
    <section className="ns-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ns-text)]">
            Simulações do cliente
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ns-text-secondary)]">
            Consulte as simulações revisionais vinculadas a este cliente.
          </p>
        </div>
        <Link href={`/calculos/novo?clientId=${clientId}`} className="ns-btn-primary">
          Nova simulação
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[var(--ns-bg)] text-xs uppercase tracking-wide text-[var(--ns-text-secondary)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Financeira</th>
              <th className="px-4 py-3 font-semibold">Valor financiado</th>
              <th className="px-4 py-3 font-semibold">Economia estimada</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ns-border)]">
            {calculations.map((calculation) => (
              <tr key={calculation.id} className="transition hover:bg-[var(--ns-surface-hover)]">
                <td className="px-4 py-3 text-[var(--ns-text-secondary)]">
                  {calculation.financial_institution ?? "Não informado"}
                </td>
                <td className="px-4 py-3 text-[var(--ns-text-secondary)]">
                  {formatCalculationCurrency(calculation.financed_value)}
                </td>
                <td className="px-4 py-3 text-[var(--ns-text-secondary)]">
                  {formatCalculationCurrency(calculation.estimated_savings)}
                </td>
                <td className="px-4 py-3">
                  <CalculationStatusBadge status={calculation.status} />
                </td>
                <td className="px-4 py-3 text-[var(--ns-text-secondary)]">
                  {formatCalculationDateTime(calculation.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/calculos/${calculation.id}`} className="ns-btn-secondary">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {!calculations.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-[var(--ns-text-secondary)]" colSpan={6}>
                  Nenhuma simulação encontrada para este cliente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
