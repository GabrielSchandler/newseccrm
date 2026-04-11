import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientToast } from "@/components/clients/client-toast";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesKanban } from "@/components/pre-sales/pre-sales-kanban";
import { PreSalesList } from "@/components/pre-sales/pre-sales-list";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { onlyDigits } from "@/lib/clients/masks";
import type {
  ClientOption,
  PreSale,
  PreSaleStatus,
  PreSaleWithRelations,
  UserProfileOption,
} from "@/types/pre-sale";
import { preSaleStatuses } from "@/types/pre-sale";

type PreVendasPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    consultant?: string;
    success?: string;
  }>;
};

function attachRelations(
  preSales: PreSale[],
  clients: ClientOption[],
  consultants: UserProfileOption[],
): PreSaleWithRelations[] {
  return preSales.map((preSale) => ({
    ...preSale,
    client: clients.find((client) => client.id === preSale.client_id) ?? null,
    consultant:
      consultants.find((consultant) => consultant.id === preSale.consultant_user_id) ??
      null,
  }));
}

export default async function PreVendasPage({ searchParams }: PreVendasPageProps) {
  const params = await searchParams;
  const { supabase, companyId } = await getCurrentUserContext();
  const search = params.q?.trim() ?? "";
  const cpfSearch = onlyDigits(search);
  const status = params.status as PreSaleStatus | undefined;

  let preSalesQuery = supabase
    .from("pre_sales")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status && preSaleStatuses.some((item) => item.value === status)) {
    preSalesQuery = preSalesQuery.eq("status", status);
  }

  if (params.consultant) {
    preSalesQuery = preSalesQuery.eq("consultant_user_id", params.consultant);
  }

  const [
    { data: preSalesData, error },
    { data: clientsData },
    { data: consultantsData },
  ] = await Promise.all([
    preSalesQuery,
    supabase
      .from("clients")
      .select("id, full_name, cpf, phone_mobile")
      .eq("company_id", companyId),
    supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", companyId),
  ]);

  const clients = (clientsData ?? []) as ClientOption[];
  const consultants = (consultantsData ?? []) as UserProfileOption[];
  let preSales = attachRelations((preSalesData ?? []) as PreSale[], clients, consultants);

  if (search) {
    preSales = preSales.filter((preSale) => {
      const client = preSale.client;
      return (
        client?.full_name.toLowerCase().includes(search.toLowerCase()) ||
        client?.cpf.includes(search) ||
        (cpfSearch ? client?.cpf.includes(cpfSearch) : false)
      );
    });
  }

  const successMessage =
    params.success === "deleted" ? "Pre-venda excluida com sucesso." : null;

  return (
    <>
      <PageHeader
        title="Pre-vendas"
        description="Acompanhe oportunidades comerciais em lista e pipeline."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar por cliente ou CPF"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            >
              <option value="">Todos os status</option>
              {preSaleStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              name="consultant"
              defaultValue={params.consultant ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            >
              <option value="">Todos os consultores</option>
              {consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.full_name || consultant.email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Filtrar
            </button>
          </form>
          <div>
            <Link
              href="/pre-vendas/novo"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Nova pre-venda
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <>
            <PreSalesKanban preSales={preSales} />
            <PreSalesList preSales={preSales} />
          </>
        )}
      </div>
    </>
  );
}
