import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentRenderedContent } from "@/components/documents/document-rendered-content";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import {
  documentTemplateTypes,
  type DocumentTemplate,
  type GeneratedDocument,
} from "@/types/document";
import type { Client } from "@/types/client";
import type { UserProfileOption } from "@/types/pre-sale";

type DocumentoPageProps = {
  params: Promise<{ id: string }>;
};

function formatTemplateType(type: GeneratedDocument["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function DocumentoPage({ params }: DocumentoPageProps) {
  const { id } = await params;
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  const document = data as GeneratedDocument | null;

  if (error || !document) {
    notFound();
  }

  const [{ data: templateData }, { data: clientData }, { data: creatorData }] =
    await Promise.all([
      supabase
        .from("document_templates")
        .select("*")
        .eq("id", document.template_id)
        .maybeSingle(),
      document.client_id
        ? supabase
            .from("clients")
            .select("id, full_name")
            .eq("id", document.client_id)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      document.created_by
        ? supabase
            .from("user_profiles")
            .select("id, full_name, email, role")
            .eq("id", document.created_by)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const template = templateData as DocumentTemplate | null;
  const client = clientData as Pick<Client, "id" | "full_name"> | null;
  const creator = creatorData as UserProfileOption | null;

  return (
    <>
      <PageHeader
        title={document.title}
        description="Documento gerado e salvo a partir da pre-venda."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/documentos"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </Link>
          <Link
            href={`/pre-vendas/${document.pre_sale_id}`}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Abrir pre-venda
          </Link>
          <Link
            href={`/documentos/gerados/${document.id}/imprimir?print=1`}
            target="_blank"
            className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
          >
            Abrir PDF
          </Link>
        </div>

        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatTemplateType(document.document_type)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(client?.full_name ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Template
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(template?.name ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatDateTime(document.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuario
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {creator?.full_name || creator?.email || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(document.status)}
            </p>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Conteudo renderizado</h2>
          <div className="mt-4 bg-slate-50 p-4">
            <DocumentRenderedContent html={document.rendered_content_html} />
          </div>
        </section>
      </div>
    </>
  );
}
