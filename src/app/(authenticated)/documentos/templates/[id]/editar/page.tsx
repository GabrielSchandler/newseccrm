import { notFound } from "next/navigation";
import { updateDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getAppOrigin } from "@/lib/app-origin";
import {
  buildOnlyOfficeCallbackToken,
  buildOnlyOfficeEditorConfig,
  getOnlyOfficeMissingConfigReason,
  isOnlyOfficeConfigured,
} from "@/lib/documents/onlyoffice";
import type { DocumentCompany } from "@/lib/documents/template-engine";
import type { DocumentTemplate } from "@/types/document";

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
};

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params;
  const { supabase, companyId, role, userProfileId, fullName, email } =
    await getCurrentUserContext();

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

  const [{ data: templatesData }, { data: companyData }] = await Promise.all([
    supabase
      .from("document_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
  ]);
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const updateAction = updateDocumentTemplateAction.bind(null, template.id);
  const appOrigin = await getAppOrigin();
  const [{ data: officialDocxSignedUrl }, { data: officialPdfSignedUrl }] =
    await Promise.all([
      template.original_docx_path
        ? supabase.storage
            .from("documents")
            .createSignedUrl(template.original_docx_path, 60 * 60 * 6)
        : Promise.resolve({ data: null }),
      template.original_pdf_path
        ? supabase.storage
            .from("documents")
            .createSignedUrl(template.original_pdf_path, 60 * 10)
        : Promise.resolve({ data: null }),
    ]);
  const onlyOfficeConfigError = getOnlyOfficeMissingConfigReason();
  const onlyOfficeSession =
    template.original_docx_path &&
    officialDocxSignedUrl?.signedUrl &&
    isOnlyOfficeConfigured()
      ? buildOnlyOfficeEditorConfig({
          template,
          documentUrl: officialDocxSignedUrl.signedUrl,
          callbackUrl: `${appOrigin}/api/onlyoffice/templates/${template.id}/callback?token=${encodeURIComponent(
            buildOnlyOfficeCallbackToken({
              templateId: template.id,
              companyId,
              storagePath: template.original_docx_path,
            }),
          )}`,
          user: {
            id: userProfileId,
            name: fullName || email || "Usuario",
          },
          company: (companyData ?? null) as DocumentCompany | null,
        })
      : null;

  return (
    <>
      <PageHeader
        title="Editar template"
        description="Atualize os metadados do template e edite o DOCX oficial sem reconverter o contrato para HTML."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        <DocumentTemplateForm
          defaultValues={template}
          submitLabel="Salvar template"
          onSubmitAction={updateAction}
          templates={templates}
          officialDocxUrl={officialDocxSignedUrl?.signedUrl ?? null}
          officialPdfUrl={officialPdfSignedUrl?.signedUrl ?? null}
          onlyOfficeConfig={onlyOfficeSession?.config ?? null}
          onlyOfficeDocumentServerUrl={onlyOfficeSession?.documentServerUrl ?? null}
          onlyOfficeConfigError={onlyOfficeConfigError}
        />
      </div>
    </>
  );
}
