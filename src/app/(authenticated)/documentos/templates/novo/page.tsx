import { notFound } from "next/navigation";
import { createDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { PreviewPreSaleOption } from "@/components/documents/document-template-form";
import type { DocumentTemplate } from "@/types/document";
import type { PreSaleClientSnapshot } from "@/types/pre-sale";

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function NovoTemplatePage() {
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const [{ data: templatesData }, { data: preSalesData }] = await Promise.all([
    supabase
      .from("document_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("pre_sales")
      .select("id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const preSaleIds = (preSalesData ?? []).map((preSale) => String(preSale.id));
  const { data: snapshotsData } = preSaleIds.length
    ? await supabase
        .from("pre_sale_client_snapshot")
        .select("pre_sale_id, full_name")
        .in("pre_sale_id", preSaleIds)
    : { data: [] };
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const snapshots = (snapshotsData ?? []) as Pick<
    PreSaleClientSnapshot,
    "pre_sale_id" | "full_name"
  >[];
  const previewPreSales: PreviewPreSaleOption[] = (preSalesData ?? []).map(
    (preSale) => {
      const snapshot = snapshots.find((item) => item.pre_sale_id === preSale.id);

      return {
        id: String(preSale.id),
        label: snapshot?.full_name ?? `Pre-venda ${String(preSale.id).slice(0, 8)}`,
      };
    },
  );

  return (
    <>
      <PageHeader
        title="Novo template"
        description="Cadastre um modelo em texto ou HTML simples para gerar documentos pela pre-venda."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        <DocumentTemplateForm
          submitLabel="Criar template"
          onSubmitAction={createDocumentTemplateAction}
          templates={templates}
          previewPreSales={previewPreSales}
        />
      </div>
    </>
  );
}
