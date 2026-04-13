import { notFound } from "next/navigation";
import { createDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function NovoTemplatePage() {
  const { role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

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
        />
      </div>
    </>
  );
}
