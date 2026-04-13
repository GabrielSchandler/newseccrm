import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDocumentTemplateAction } from "@/app/(authenticated)/documentos/actions";
import { DocumentTemplateForm } from "@/components/documents/document-template-form";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { ClientToast } from "@/components/clients/client-toast";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { documentTemplateTypes, type DocumentTemplate } from "@/types/document";

type TemplatesPageProps = {
  searchParams: Promise<{ success?: string }>;
};

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function formatTemplateType(type: DocumentTemplate["type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const templates = (data ?? []) as DocumentTemplate[];
  const successMessage =
    params.success === "updated" ? "Template atualizado com sucesso." : null;

  return (
    <>
      <PageHeader
        title="Templates"
        description="Crie modelos de contrato e ordem de servico com variaveis da pre-venda."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />
        {successMessage ? <ClientToast message={successMessage} /> : null}

        <DocumentTemplateForm
          submitLabel="Criar template"
          onSubmitAction={createDocumentTemplateAction}
        />

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-950">
                Templates cadastrados
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3 font-semibold">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((template) => (
                    <tr key={template.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {displayValue(template.name)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatTemplateType(template.type)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateTime(template.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/documentos/templates/${template.id}/editar`}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!templates.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                        Nenhum template cadastrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
