import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientToast } from "@/components/clients/client-toast";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesKanban } from "@/components/pre-sales/pre-sales-kanban";
import { PreSalesList } from "@/components/pre-sales/pre-sales-list";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { canAccessAllPreSales, canCreatePreSales } from "@/lib/pre-sales/access";
import { resolveUserDisplayName } from "@/lib/users/account";
import type {
  ClientOption,
  PreSale,
  PreSaleWithRelations,
  UserProfileOption,
} from "@/types/pre-sale";

const clientOptionSelect =
  "id, full_name, cpf, phone_mobile";

type PreVendasPageProps = {
  searchParams: Promise<{
    consultant?: string;
    success?: string;
  }>;
};

function attachRelations(
  preSales: PreSale[],
  clients: ClientOption[],
  consultants: UserProfileOption[],
): PreSaleWithRelations[] {
  const clientsMap = new Map(clients.map((client) => [client.id, client]));
  const consultantsMap = new Map(
    consultants.map((consultant) => [consultant.id, consultant]),
  );

  return preSales.map((preSale) => ({
    ...preSale,
    client: clientsMap.get(preSale.client_id) ?? null,
    consultant:
      consultantsMap.get(preSale.consultant_user_id ?? "") ??
      consultantsMap.get(preSale.created_by) ??
      null,
  }));
}

export default async function PreVendasPage({ searchParams }: PreVendasPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role, businessArea, userProfileId } =
    await getCurrentUserContext();
  const canDeletePreSales = role === "admin" || role === "manager";
  const canCreatePreSale = canCreatePreSales(role, businessArea);
  const canFilterCommercialConsultant = role === "admin" || role === "manager";
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

  const [
    { data: preSalesData, error },
    { data: clientsData },
  ] = await Promise.all([
    preSalesQuery,
    supabase
      .from("clients")
      .select(clientOptionSelect)
      .eq("company_id", companyId),
  ]);

  const clients = (clientsData ?? []) as ClientOption[];
  const consultants = users.filter((consultant) =>
    canAccessAllPreSales(role, businessArea) ? true : consultant.id === userProfileId,
  );
  const preSales = attachRelations((preSalesData ?? []) as PreSale[], clients, consultants).filter(
    (preSale) => preSale.status !== "inativo" && preSale.status !== "distrato",
  );

  const successMessage =
    params.success === "deleted" ? "Pre-venda excluida com sucesso." : null;
  const approvedPreSales = preSales.filter((preSale) => preSale.status === "aprovado").length;
  const activeConsultants = new Set(
    preSales
      .map((preSale) => preSale.consultant_user_id ?? preSale.created_by)
      .filter(Boolean),
  ).size;

  return (
    <>
      <PageHeader
        title="Pre-vendas"
        description="Acompanhe oportunidades comerciais em lista e pipeline."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-teal-50/50 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Operacao comercial
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Pipeline de oportunidades
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {preSales.length} pre-venda(s) ativa(s), {approvedPreSales} aprovada(s)
                {activeConsultants ? ` e ${activeConsultants} consultor(es) com oportunidades.` : "."}
              </p>
            </div>
            {canCreatePreSale ? (
              <Link
                href="/pre-vendas/novo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Nova pre-venda
              </Link>
            ) : null}
          </div>
          {canFilterCommercialConsultant ? (
            <form className="grid gap-3 p-5 md:grid-cols-[minmax(240px,420px)_auto]">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Consultor comercial</span>
                <select
                  name="consultant"
                  defaultValue={selectedConsultantId}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                >
                  <option value="">Todos os consultores comerciais</option>
                  {commercialConsultants.map((consultant) => (
                    <option key={consultant.id} value={consultant.id}>
                      {resolveUserDisplayName(consultant, "Sem nome")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="self-end rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Filtrar
              </button>
            </form>
          ) : null}
        </section>

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
