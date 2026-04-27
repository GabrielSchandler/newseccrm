import Link from "next/link";
import { redirect } from "next/navigation";
import { CalculationPdfActions } from "@/components/calculations/calculation-pdf-actions";
import { CalculationStatusBadge } from "@/components/calculations/calculation-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  formatCalculationCurrency,
  formatCalculationDateTime,
} from "@/lib/calculations/formatters";
import {
  canManageCalculations,
  listCalculationCreators,
} from "@/lib/calculations/service";
import { onlyDigits } from "@/lib/clients/masks";
import type { FinancingCalculation } from "@/types/calculation";

type CalculosPageProps = {
  searchParams: Promise<{
    success?: string;
    q?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }>;
};

function successMessage(success?: string) {
  if (success === "created") {
    return "Calculo criado com sucesso.";
  }

  if (success === "updated") {
    return "Calculo atualizado com sucesso.";
  }

  return null;
}

export default async function CalculosPage({ searchParams }: CalculosPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageCalculations(role)) {
    redirect(role === "seller" ? "/pre-vendas" : "/dashboard");
  }

  let query = supabase
    .from("financing_calculations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const trimmedQuery = params.q?.trim();
  const cpfDigits = onlyDigits(trimmedQuery ?? "");

  if (trimmedQuery) {
    if (cpfDigits) {
      query = query.or(
        `client_name.ilike.%${trimmedQuery}%,client_cpf.ilike.%${cpfDigits}%`,
      );
    } else {
      query = query.ilike("client_name", `%${trimmedQuery}%`);
    }
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.date_from) {
    query = query.gte("created_at", `${params.date_from}T00:00:00`);
  }

  if (params.date_to) {
    query = query.lte("created_at", `${params.date_to}T23:59:59`);
  }

  const { data, error } = await query;
  const calculations = (data ?? []) as FinancingCalculation[];
  const creators = await listCalculationCreators(
    calculations.map((item) => item.created_by ?? ""),
  );
  const creatorMap = new Map(
    creators.map((creator) => [
      creator.id,
      creator.full_name ?? creator.email ?? "Nao informado",
    ]),
  );
  const bannerMessage = successMessage(params.success);

  return (
    <>
      <PageHeader
        title="Calculos"
        description="Central de calculo revisional com historico, filtros e geracao de PDF para o cliente."
      />
      <div className="space-y-6 p-6">
        {bannerMessage ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {bannerMessage}
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="q">
                Busca por cliente ou CPF
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              >
                <option value="">Todos</option>
                <option value="calculado">Calculado</option>
                <option value="pdf_gerado">PDF gerado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="date_from">
                De
              </label>
              <input
                id="date_from"
                name="date_from"
                type="date"
                defaultValue={params.date_from ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="date_to">
                Ate
              </label>
              <input
                id="date_to"
                name="date_to"
                type="date"
                defaultValue={params.date_to ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Filtrar
              </button>
              <Link
                href="/calculos"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Limpar
              </Link>
            </div>
          </form>
        </section>

        <div className="flex justify-end">
          <Link
            href="/calculos/novo"
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Novo calculo
          </Link>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">CPF</th>
                    <th className="px-4 py-3 font-semibold">Financeira</th>
                    <th className="px-4 py-3 font-semibold">Valor financiado</th>
                    <th className="px-4 py-3 font-semibold">Valor da parcela</th>
                    <th className="px-4 py-3 font-semibold">Parcelas</th>
                    <th className="px-4 py-3 font-semibold">Economia estimada</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3 font-semibold">Criado por</th>
                    <th className="px-4 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculations.map((calculation) => (
                    <tr key={calculation.id} className="align-top transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {calculation.client_name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {calculation.client_cpf}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {calculation.financer_name ?? "Nao informado"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCalculationCurrency(calculation.financed_value)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCalculationCurrency(
                          calculation.current_installment_value,
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {calculation.installment_count ?? "Nao informado"}
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
                      <td className="px-4 py-3 text-slate-700">
                        {creatorMap.get(calculation.created_by ?? "") ?? "Nao informado"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/calculos/${calculation.id}`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Ver
                            </Link>
                            <Link
                              href={`/calculos/${calculation.id}/editar`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Editar
                            </Link>
                          </div>
                          <CalculationPdfActions
                            calculationId={calculation.id}
                            hasPdf={Boolean(calculation.pdf_storage_path)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!calculations.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                        Nenhum calculo encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
