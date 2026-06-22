import { notFound } from "next/navigation";
import { createDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  legalWorkflowStages,
  mapLegalWorkflowStageRow,
} from "@/lib/legal/workflow";
import type { DocumentTemplate } from "@/types/document";

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function NovoTemplatePage() {
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const [{ data: templatesData }, { data: stagesData, error: stagesError }] =
    await Promise.all([
      supabase
        .from("document_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("legal_workflow_stages")
        .select("id, legacy_key, title, short_title, description, color, expected_documents, position")
        .eq("company_id", companyId)
        .order("position"),
    ]);
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const workflowStages = !stagesError && stagesData?.length
    ? stagesData.map(mapLegalWorkflowStageRow)
    : legalWorkflowStages;

  return (
    <>
      <PageHeader
        title="Novo template"
        description="Cadastre o template, salve e depois vincule o DOCX oficial preparado no Word com as variaveis do contrato."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        <DocumentTemplateForm
          submitLabel="Criar template"
          onSubmitAction={createDocumentTemplateAction}
          templates={templates}
          workflowStages={workflowStages}
        />
      </div>
    </>
  );
}
