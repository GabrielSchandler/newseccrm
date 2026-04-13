import { notFound } from "next/navigation";
import { updateDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { DocumentTemplate } from "@/types/document";

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
};

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  const template = data as DocumentTemplate | null;

  if (error || !template) {
    notFound();
  }

  const updateAction = updateDocumentTemplateAction.bind(null, template.id);

  return (
    <>
      <PageHeader
        title="Editar template"
        description="Atualize o texto base usado para gerar documentos."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        <DocumentTemplateForm
          defaultValues={template}
          submitLabel="Salvar template"
          onSubmitAction={updateAction}
        />
      </div>
    </>
  );
}
