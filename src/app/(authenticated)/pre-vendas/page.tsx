import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { ClientToast } from "@/components/clients/client-toast";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesKanban } from "@/components/pre-sales/pre-sales-kanban";
import { PreSalesList } from "@/components/pre-sales/pre-sales-list";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { canAccessAllPreSales, canCreatePreSales } from "@/lib/pre-sales/access";
import { getPreSaleSearchMatches } from "@/lib/pre-sales/search";
import { resolveUserDisplayName } from "@/lib/users/account";
import type {
  ClientOption,
  PreSale,
  PreSaleDebtHolder,
  PreSaleWithRelations,
  UserProfileOption,
} from "@/types/pre-sale";

const clientOptionSelect =
  "id, full_name, cpf, phone_mobile";

type PreVendasPageProps = {
  searchParams: Promise<{
    consultant?: string;
    q?: string;
    success?: string;
  }>;
};

function attachRelations(
  preSales: PreSale[],
  clients: ClientOption[],
  consultants: UserProfileOption[],
  debtHolders: Array<Pick<PreSaleDebtHolder, "pre_sale_id" | "full_name" | "cpf">>,
  searchTerm: string,
): PreSaleWithRelations[] {
  const clientsMap = new Map(clients.map((client) => [client.id, client]));
  const consultantsMap = new Map(
    consultants.map((consultant) => [consultant.id, consultant]),
  );
  const debtHoldersMap = new Map(
    debtHolders.map((debtHolder) => [debtHolder.pre_sale_id, debtHolder]),
  );

  return preSales.map((preSale) => {
    const client = clientsMap.get(preSale.client_id) ?? null;
    const debtHolder = debtHoldersMap.get(preSale.id) ?? null;

    return {
      ...preSale,
      client,
      debtHolder,
      searchMatches: getPreSaleSearchMatches(searchTerm, client, debtHolder),
      consultant:
        consultantsMap.get(preSale.consultant_user_id ?? "") ??
        consultantsMap.get(preSale.created_by) ??
        null,
    };
  });
}

export default async function PreVendasPage({ searchParams }: PreVendasPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role, businessArea, userProfileId } =
    await getCurrentUserContext();
  const canDeletePreSales = role === "admin" || role === "manager";
  const canCreatePreSale = canCreatePreSales(role, businessArea);
  const canFilterCommercialConsultant = role === "admin" || role === "manager";
  const searchTerm = (params.q ?? "").trim();
  const { data: consultantsData } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email, role, business_area, is_active")
    .eq("company_id", companyId);
  const users = (consultantsData ?? []) as UserProfileOption[];
  const commercialConsultants = users.filter(
    (consultant) =>
      consultant.role === "seller" &&
      consultant.business_area === "commercial" &&
      consultant.is_active !== false,
  );
  const selectedConsultantId =
    canFilterCommercialConsultant &&
    params.consultant &&
    commercialConsultants.some((consultant) => consultant.id === params.consultant)
      ? params.consultant
      : "";

  let preSalesQuery = supabase
    .from("pre_sales")
    .select(
      "id, client_id, consultant_user_id, created_by, status, pre_sale_type, service_type, contract_value, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!canAccessAllPreSales(role, businessArea)) {
    preSalesQuery = preSalesQuery.or(
      `consultant_user_id.eq.${userProfileId},created_by.eq.${userProfileId}`,
    );
  }

  if (selectedConsultantId) {
    preSalesQuery = preSalesQuery.or(
      `consultant_user_id.eq.${selectedConsultantId},created_by.eq.${selectedConsultantId}`,
    );
  }

  const [{ data: preSalesData, error }, { data: clientsData }] = await Promise.all([
    preSalesQuery,
    supabase
      .from("clients")
      .select(clientOptionSelect)
      .eq("company_id", companyId),
  ]);

  const preSaleRows = (preSalesData ?? []) as PreSale[];
  const { data: debtHoldersData } = preSaleRows.length
    ? await supabase
        .from("pre_sale_debt_holders")
        .select("pre_sale_id, full_name, cpf")
        .in(
          "pre_sale_id",
          preSaleRows.map((preSale) => preSale.id),
        )
    : { data: [] };
  const clients = (clientsData ?? []) as ClientOption[];
  const debtHolders =
    (debtHoldersData ?? []) as Array<
      Pick<PreSaleDebtHolder, "pre_sale_id" | "full_name" | "cpf">
    >;
  const consultants = users.filter((consultant) =>
    canAccessAllPreSales(role, businessArea) ? true : consultant.id === userProfileId,
  );
  const preSales = attachRelations(
    preSaleRows,
    clients,
    consultants,
    debtHolders,
    searchTerm,
  ).filter(
    (preSale) =>
      preSale.status !== "inativo" &&
      preSale.status !== "distrato" &&
      (!searchTerm || Boolean(preSale.searchMatches?.length)),
  );

  const successMessage =
    params.success === "deleted" ? "Pré-venda excluída com sucesso." : null;

  return (
    <>
      <PageHeader
        title="Pré-vendas"
        description="Acompanhe oportunidades comerciais em lista e pipeline."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form
            className={`grid gap-3 ${
              canFilterCommercialConsultant
                ? "lg:grid-cols-[minmax(260px,1fr)_minmax(240px,420px)_auto_auto]"
                : "lg:grid-cols-[minmax(260px,1fr)_auto_auto]"
            }`}
          >
            <label className="relative block">
              <span className="sr-only">Buscar por cliente ou financiado</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                defaultValue={searchTerm}
                placeholder="Buscar por nome ou CPF do cliente/financiado"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
            </label>
            {canFilterCommercialConsultant ? (
              <select
                name="consultant"
                defaultValue={selectedConsultantId}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              >
                <option value="">Todos os consultores comerciais</option>
                {commercialConsultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {resolveUserDisplayName(consultant, "Sem nome")}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Filtrar
            </button>
            {searchTerm || selectedConsultantId ? (
              <Link
                href="/pre-vendas"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Limpar
              </Link>
            ) : null}
          </form>
          {canCreatePreSale ? (
            <div>
              <Link
                href="/pre-vendas/novo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Nova pré-venda
              </Link>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <>
            <PreSalesKanban
              preSales={preSales}
              canDelete={canDeletePreSales}
            />
            <PreSalesList preSales={preSales} canDelete={canDeletePreSales} />
          </>
        )}
      </div>
    </>
  );
}
