import { LegalKanban, type LegalBoardPreSale } from "@/components/legal/legal-kanban";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { normalizeLegalWorkflowStage } from "@/lib/legal/workflow";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import type { ClientOption, PreSale, UserProfileOption } from "@/types/pre-sale";

function canUseLegalArea(role: string | null, businessArea: string) {
  return role === "admin" || role === "manager" || (role === "seller" && businessArea === "legal");
}

export default async function JuridicoPage() {
  const { supabase, companyId, role, businessArea, userProfileId } = await getCurrentUserContext();

  if (!canUseLegalArea(role, businessArea)) {
    return null;
  }

  const [
    { data: preSalesData, error: preSalesError },
    { data: clientsData },
    { data: consultantsData },
    { data: templatesData },
  ] = await Promise.all([
    supabase
      .from("pre_sales")
      .select("*")
      .eq("company_id", companyId)
      .neq("status", "perdido")
      .order("legal_stage_updated_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("clients")
      .select("*")
      .eq("company_id", companyId),
    supabase
      .from("user_profiles")
      .select("id, full_name, nickname, username, email, role, business_area, is_active, legal_role")
      .eq("company_id", companyId),
    supabase
      .from("document_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const allPreSales = (preSalesData ?? []) as PreSale[];
  const legalPreSalesBase = allPreSales.filter(
    (preSale) => preSale.status === "aprovado" || Boolean(preSale.legal_stage),
  );
  const generatedPreSaleIds = legalPreSalesBase.map((preSale) => preSale.id);

  const [{ data: generatedDocumentsData }] = await Promise.all([
    generatedPreSaleIds.length
      ? supabase
          .from("generated_documents")
          .select("*")
          .eq("company_id", companyId)
          .in("pre_sale_id", generatedPreSaleIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const clients = (clientsData ?? []) as Array<
    Pick<ClientOption, "id" | "full_name"> & {
      legal_responsible_user_id: string | null;
      legal_consultant_user_id: string | null;
    }
  >;
  const consultants = (consultantsData ?? []) as Array<
    UserProfileOption & {
      business_area?: string | null;
      is_active?: boolean | null;
    }
  >;
  const legalAdmins = consultants.filter(
    (consultant) =>
      consultant.business_area === "legal" &&
      consultant.is_active !== false &&
      consultant.legal_role === "admin",
  );
  const legalConsultants = consultants.filter(
    (consultant) =>
      consultant.business_area === "legal" &&
      consultant.is_active !== false &&
      (consultant.legal_role === "consultant" || !consultant.legal_role),
  );
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const generatedDocuments = (generatedDocumentsData ?? []) as GeneratedDocument[];

  const legalPreSales: LegalBoardPreSale[] = legalPreSalesBase.map((preSale) => {
    const currentLegalStage = normalizeLegalWorkflowStage(preSale.legal_stage);
    const client = clients.find((item) => item.id === preSale.client_id) ?? null;
    const stageUpdatedAt =
      preSale.legal_stage_updated_at ?? preSale.updated_at ?? preSale.created_at;

    return {
      ...preSale,
      client,
      legalResponsibleUserId: client?.legal_responsible_user_id ?? null,
      legalConsultantUserId: client?.legal_consultant_user_id ?? null,
      consultant:
        consultants.find(
          (consultant) =>
            consultant.id === preSale.consultant_user_id ||
            consultant.id === preSale.created_by,
        ) ??
        null,
      currentLegalStage,
      stageUpdatedAt,
      generatedDocuments: generatedDocuments.filter(
        (document) => document.pre_sale_id === preSale.id,
      ),
    };
  });

  return (
    <>
      <PageHeader
        title="Esteira juridica"
        description="Acompanhe em que fase cada cliente esta, ha quanto tempo e gere os documentos da etapa certa."
      />
      <div className="space-y-6 p-6">
        {preSalesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {preSalesError.message}
          </div>
        ) : null}
        <LegalKanban
          preSales={legalPreSales}
          templates={templates}
          legalAdmins={legalAdmins}
          legalConsultants={legalConsultants}
          currentUserId={userProfileId}
        />
      </div>
    </>
  );
}
