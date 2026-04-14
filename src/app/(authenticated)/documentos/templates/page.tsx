import { Edit, Eye, Plus } from "lucide-react";
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
  type DocumentTemplateType,
} from "@/types/document";

type TemplatesPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    active?: string;
  }>;
};

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function formatTemplateType(type: DocumentTemplate["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageTemplates(role)) {
    notFound();
  }

  const search = params.q?.trim() ?? "";
  const type = params.type as DocumentTemplateType | undefined;
  const active = params.active ?? "all";
  let query = supabase
    .from("document_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  if (type && documentTemplateTypes.some((item) => item.value === type)) {
    query = query.eq("document_type", type);
  }

  if (active === "active") {
    query = query.eq("is_active", true);
  } else if (active === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;
  const templates = (data ?? []) as DocumentTemplate[];

  return (
    <>
      <PageHeader
        title="Templates"
        description="Modelos de contrato, ordem de servico e documentos operacionais da empresa."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar por nome"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            >
              <option value="">Todos os tipos</option>
              {documentTemplateTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              name="active"
              defaultValue={active}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Filtrar
            </button>
          </form>
          <div>
            <Link
              href="/documentos/templates/novo"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Novo template
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">DOCX oficial</th>
                    <th className="px-4 py-3 font-semibold">Ativo</th>
                    <th className="px-4 py-3 font-semibold">Padrao</th>
                    <th className="px-4 py-3 font-semibold">Atualizado em</th>
                    <th className="px-4 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((template) => (
                    <tr key={template.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {displayValue(template.name)}
                        </p>
                        {template.description ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {template.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatTemplateType(template.document_type)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            template.original_docx_path
                              ? "bg-teal-50 text-teal-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {template.original_docx_path ? "Vinculado" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            template.is_active
                              ? "bg-teal-50 text-teal-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {template.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            template.is_default
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {template.is_default ? "Padrao" : "Nao"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateTime(template.updated_at ?? template.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/documentos/templates/${template.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                          <Link
                            href={`/documentos/templates/${template.id}/editar`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Link>
                          <DocumentTemplateActions
                            templateId={template.id}
                            isActive={template.is_active}
                            isDefault={template.is_default}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!templates.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        Nenhum template encontrado.
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
