import { notFound } from "next/navigation";
import { createDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { DocumentTemplate } from "@/types/document";

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function NovoTemplatePage() {
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const { data: templatesData } = await supabase
    .from("document_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const templates = (templatesData ?? []) as DocumentTemplate[];

  return (
    <>
      <PageHeader
        title="Novo template"
        description="Cadastre os dados do template e depois vincule o DOCX oficial para editar o contrato no fluxo nativo."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        <DocumentTemplateForm
          submitLabel="Criar template"
          onSubmitAction={createDocumentTemplateAction}
          templates={templates}
        />
      </div>
    </>
  );
}
