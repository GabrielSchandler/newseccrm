import Link from "next/link";
import { DocumentDeleteButton } from "@/components/documents/document-delete-button";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { listAccessiblePreSaleIdsForCurrentUser } from "@/lib/pre-sales/access";
import { resolveUserDisplayName } from "@/lib/users/account";
import {
  documentStatusLabels,
  documentTemplateTypes,
  type DocumentTemplate,
  type DocumentTemplateType,
  type GeneratedDocument,
} from "@/types/document";
import type { Client } from "@/types/client";
import type { UserProfileOption } from "@/types/pre-sale";

type DocumentosPageProps = {
  searchParams: Promise<{
    type?: string;
    client?: string;
    from?: string;
    to?: string;
  }>;
};

function formatTemplateType(type: DocumentTemplateType | null | undefined) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? "-";
}

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const params = await searchParams;
  const { supabase, companyId, role, businessArea, userProfileId } =
    await getCurrentUserContext();
  const canDeleteDocuments = role === "admin" || role === "manager";
  const type = params.type as DocumentTemplateType | undefined;
  let query = supabase
    .from("generated_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (type && documentTemplateTypes.some((item) => item.value === type)) {
    query = query.eq("document_type", type);
  }

  if (params.client?.trim()) {
    query = query.eq("client_id", params.client.trim());
  }

  if (params.from) {
    query = query.gte("created_at", params.from);
  }

  if (params.to) {
    query = query.lte("created_at", `${params.to}T23:59:59`);
  }

  const { data, error } = await query;
  let documents = (data ?? []) as GeneratedDocument[];

  if (role === "seller" && businessArea !== "legal") {
    const accessiblePreSaleIds = new Set(
      (await listAccessiblePreSaleIdsForCurrentUser()) ?? [],
    );
    documents = documents.filter(
      (document) =>
        document.created_by === userProfileId ||
        (document.pre_sale_id ? accessiblePreSaleIds.has(document.pre_sale_id) : false),
    );
  }
  const templateIds = Array.from(new Set(documents.map((document) => document.template_id)));
  const clientIds = Array.from(
    new Set(documents.map((document) => document.client_id).filter(Boolean)),
  ) as string[];
  const creatorIds = Array.from(
    new Set(documents.map((document) => document.created_by).filter(Boolean)),
  ) as string[];

  const [
    { data: templatesData },
    { data: clientsData },
    { data: creatorsData },
    { data: clientOptionsData },
  ] = await Promise.all([
    templateIds.length
      ? supabase.from("document_templates").select("*").in("id", templateIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? supabase
          .from("clients")
          .select("id, full_name")
          .eq("company_id", companyId)
          .in("id", clientIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length
      ? supabase
          .from("user_profiles")
          .select("id, full_name, username, email, role")
          .eq("company_id", companyId)
          .in("id", creatorIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("clients")
      .select("id, full_name")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true }),
  ]);
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const clients = (clientsData ?? []) as Pick<Client, "id" | "full_name">[];
  const creators = (creatorsData ?? []) as UserProfileOption[];
  const clientOptions = (clientOptionsData ?? []) as Pick<Client, "id" | "full_name">[];
  const templatesMap = new Map(templates.map((template) => [template.id, template]));
  const clientsMap = new Map(clients.map((client) => [client.id, client]));
  const creatorsMap = new Map(creators.map((creator) => [creator.id, creator]));

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Documentos gerados a partir das pré-vendas da empresa."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[220px_1fr_160px_160px_auto]">
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
            name="client"
            defaultValue={params.client ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            <option value="">Todos os clientes</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
          <input
            name="from"
            type="date"
            defaultValue={params.from ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
          <input
            name="to"
            type="date"
            defaultValue={params.to ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Filtrar
          </button>
        </form>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Título</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Fonte</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Criado por</th>
                    <th className="px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => {
                    const template = document.template_id
                      ? templatesMap.get(document.template_id)
                      : undefined;
                    const client = document.client_id
                      ? clientsMap.get(document.client_id)
                      : undefined;
                    const creator = document.created_by
                      ? creatorsMap.get(document.created_by)
                      : undefined;

                    return (
                      <tr key={document.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {displayValue(document.title)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatTemplateType(document.document_type)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {displayValue(client?.full_name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {displayValue(template?.name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {document.render_source === "pdf"
                            ? "PDF"
                            : document.render_source === "docx"
                              ? "DOCX"
                              : "HTML"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {document.pdf_error_message
                            ? "DOCX gerado, PDF pendente"
                            : documentStatusLabels[document.status] ?? document.status}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDateTime(document.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {resolveUserDisplayName(creator)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/documentos/gerados/${document.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Visualizar
                          </Link>
                          {document.render_source === "html" ? (
                            <Link
                              href={`/documentos/gerados/${document.id}/imprimir?print=1`}
                              target="_blank"
                              className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                            >
                              PDF HTML
                            </Link>
                          ) : null}
                          {canDeleteDocuments ? (
                            <DocumentDeleteButton
                              documentId={document.id}
                              variant="inline"
                            />
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!documents.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={9}>
                        Nenhum documento gerado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
