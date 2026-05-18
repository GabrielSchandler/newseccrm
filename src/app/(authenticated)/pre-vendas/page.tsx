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
  "id, full_name, cpf, rg, birth_date, marital_status, profession, email, phone_mobile, phone_secondary, zip_code, street, number, district, city, state";

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
  return preSales.map((preSale) => ({
    ...preSale,
    client: clients.find((client) => client.id === preSale.client_id) ?? null,
    consultant:
      consultants.find(
        (consultant) =>
          consultant.id === preSale.consultant_user_id ||
          consultant.id === preSale.created_by,
      ) ??
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!canAccessAllPreSales(role, businessArea)) {
    preSalesQuery = preSalesQuery.or(
      `consultant_user_id.eq.${userProfileId},created_by.eq.${userProfileId}`,
    );
  }

  preSalesQuery = preSalesQuery.neq("status", "inativo").neq("status", "distrato");

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
  const preSales = attachRelations((preSalesData ?? []) as PreSale[], clients, consultants);

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
          {canFilterCommercialConsultant ? (
            <form className="grid gap-3 md:grid-cols-[minmax(240px,420px)_auto]">
              <label className="sr-only" htmlFor="commercial-consultant-filter">
                Consultor comercial
              </label>
              <select
                id="commercial-consultant-filter"
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
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Filtrar
              </button>
            </form>
          ) : null}
          {canCreatePreSale ? (
            <div>
              <Link
                href="/pre-vendas/novo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Nova pre-venda
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
