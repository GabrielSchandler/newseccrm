import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentTemplateActions } from "@/components/documents/document-template-actions";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  documentTemplateTypes,
  type DocumentTemplate,
} from "@/types/document";

type TemplatePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function formatTemplateType(type: DocumentTemplate["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function TemplatePage({
  params,
  searchParams,
}: TemplatePageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
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

  const [{ data: officialDocxSignedUrl }, { data: officialPdfSignedUrl }] =
    await Promise.all([
      template.original_docx_path
        ? supabase.storage
            .from("documents")
            .createSignedUrl(template.original_docx_path, 60 * 10)
        : Promise.resolve({ data: null }),
      template.original_pdf_path
        ? supabase.storage
            .from("documents")
            .createSignedUrl(template.original_pdf_path, 60 * 10)
        : Promise.resolve({ data: null }),
    ]);

  return (
    <>
      <PageHeader
        title={template.name}
        description="Visualizacao do template salvo para esta empresa."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        {queryParams.success === "updated" ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            Template atualizado com sucesso.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/documentos/templates/${template.id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          <DocumentTemplateActions
            templateId={template.id}
            isActive={template.is_active}
            isDefault={template.is_default}
          />
          {officialDocxSignedUrl?.signedUrl ? (
            <Link
              href={officialDocxSignedUrl.signedUrl}
              target="_blank"
              className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
            >
              Baixar DOCX oficial
            </Link>
          ) : null}
          {officialPdfSignedUrl?.signedUrl ? (
            <Link
              href={officialPdfSignedUrl.signedUrl}
              target="_blank"
              className="rounded-lg border border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
            >
              Baixar PDF oficial
            </Link>
          ) : null}
        </div>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatTemplateType(template.document_type)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {template.is_active ? "Ativo" : "Inativo"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Padrao
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {template.is_default ? "Sim" : "Nao"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Atualizado em
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatDateTime(template.updated_at ?? template.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              DOCX oficial
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(template.original_docx_filename)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              PDF oficial
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(template.original_pdf_filename)}
            </p>
          </div>
          <div className="md:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Descricao
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(template.description)}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Conteudo</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-900">
            {template.content_html}
          </pre>
        </section>
      </div>
    </>
  );
}
