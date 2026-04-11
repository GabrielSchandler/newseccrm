import { notFound } from "next/navigation";
import { updatePreSaleAction } from "@/app/(authenticated)/pre-vendas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesForm } from "@/components/pre-sales/pre-sales-form";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { preSaleToFormValues } from "@/lib/pre-sales/schema";
import type { ClientOption, PreSale, UserProfileOption } from "@/types/pre-sale";

type EditarPreVendaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarPreVendaPage({ params }: EditarPreVendaPageProps) {
  const { id } = await params;
  const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

  const [{ data, error }, { data: clientsData }, { data: consultantsData }] =
    await Promise.all([
      supabase.from("pre_sales").select("*").eq("id", id).eq("company_id", companyId).single(),
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
  const preSale = data as PreSale | null;

  if (error || !preSale) {
    notFound();
  }

  const canEdit =
    role === "admin" ||
    role === "manager" ||
    preSale.consultant_user_id === userProfileId;

  if (!canEdit) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar pre-venda"
        description="Atualize os dados e status da oportunidade."
      />
      <div className="p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <PreSalesForm
            clients={(clientsData ?? []) as ClientOption[]}
            consultants={(consultantsData ?? []) as UserProfileOption[]}
            submitLabel="Salvar alteracoes"
            defaultValues={preSaleToFormValues(preSale)}
            onSubmitAction={updatePreSaleAction.bind(null, preSale.id)}
          />
        </div>
      </div>
    </>
  );
}
