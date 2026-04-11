import { createPreSaleAction } from "@/app/(authenticated)/pre-vendas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesForm } from "@/components/pre-sales/pre-sales-form";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { ClientOption, UserProfileOption } from "@/types/pre-sale";

export default async function NovaPreVendaPage() {
  const { supabase, companyId } = await getCurrentUserContext();
  const [{ data: clientsData }, { data: consultantsData }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, cpf, phone_mobile")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Nova pre-venda"
        description="Crie uma oportunidade vinculada a um cliente e consultor da empresa."
      />
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <PreSalesForm
            clients={(clientsData ?? []) as ClientOption[]}
            consultants={(consultantsData ?? []) as UserProfileOption[]}
            submitLabel="Cadastrar pre-venda"
            onSubmitAction={createPreSaleAction}
          />
        </div>
      </div>
    </>
  );
}
