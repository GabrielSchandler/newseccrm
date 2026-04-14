import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/clients/formatters";
import { formatCurrency } from "@/lib/pre-sales/formatters";
import type { GeneratedDocument } from "@/types/document";
import type { PreSale, PreSaleStatus } from "@/types/pre-sale";
import { preSaleStatuses } from "@/types/pre-sale";

type StatCardProps = {
  label: string;
  value: string | number;
  href: string;
};

function StatCard({ label, value, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </Link>
  );
}

function countByStatus(preSales: PreSale[], status: PreSaleStatus) {
  return preSales.filter((preSale) => preSale.status === status).length;
}

export default async function DashboardPage() {
  const { supabase, companyId } = await getCurrentUserContext();
  const [
    { count: activeClients },
    { data: preSalesData },
    { count: generatedDocuments },
    { data: recentDocumentsData },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("pre_sales")
      .select("id, status, contract_value, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("generated_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const preSales = (preSalesData ?? []) as PreSale[];
  const recentDocuments = (recentDocumentsData ?? []) as GeneratedDocument[];
  const openPreSales = preSales.filter(
    (preSale) => preSale.status !== "aprovado" && preSale.status !== "perdido",
  ).length;
  const approvedValue = preSales
    .filter((preSale) => preSale.status === "aprovado")
    .reduce((total, preSale) => total + Number(preSale.contract_value ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visao geral da operacao comercial e documental da empresa."
      />
      <div className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Clientes ativos"
            value={activeClients ?? 0}
            href="/clientes"
          />
          <StatCard
            label="Pre-vendas abertas"
            value={openPreSales}
            href="/pre-vendas"
          />
          <StatCard
            label="Valor aprovado"
            value={formatCurrency(approvedValue)}
            href="/pre-vendas?status=aprovado"
          />
          <StatCard
            label="Documentos gerados"
            value={generatedDocuments ?? 0}
            href="/documentos"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                Pre-vendas por status
              </h2>
              <Link
                href="/pre-vendas"
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                Ver pipeline
              </Link>
            </div>
            <div className="space-y-3">
              {preSaleStatuses.map((status) => {
                const count = countByStatus(preSales, status.value);
                const percentage = preSales.length ? (count / preSales.length) * 100 : 0;

                return (
                  <div key={status.value}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{status.label}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                Documentos recentes
              </h2>
              <Link
                href="/documentos"
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                Ver todos
              </Link>
            </div>
            <div className="space-y-3">
              {recentDocuments.map((document) => (
                <Link
                  key={document.id}
                  href={`/documentos/gerados/${document.id}`}
                  className="block rounded-lg border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {document.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(document.created_at)}
                  </p>
                </Link>
              ))}
              {!recentDocuments.length ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Nenhum documento gerado ainda.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
