import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import type { PreSaleClientSnapshot } from "@/types/pre-sale";

type DocumentoPageProps = {
  params: Promise<{ id: string }>;
};

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

  const [{ data: templateData }, { data: snapshotData }] = await Promise.all([
    supabase
      .from("document_templates")
      .select("*")
      .eq("id", document.template_id)
      .maybeSingle(),
    supabase
      .from("pre_sale_client_snapshot")
      .select("pre_sale_id, full_name")
      .eq("pre_sale_id", document.pre_sale_id)
      .maybeSingle(),
  ]);
  const template = templateData as DocumentTemplate | null;
  const snapshot = snapshotData as Pick<PreSaleClientSnapshot, "pre_sale_id" | "full_name"> | null;

  return (
    <>
      <PageHeader
        title={displayValue(template?.name ?? null)}
        description="Documento gerado e salvo a partir da pre-venda."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(snapshot?.full_name ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gerado em
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatDateTime(document.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pre-venda
            </p>
            <Link
              href={`/pre-vendas/${document.pre_sale_id}`}
              className="mt-1 inline-flex text-sm font-semibold text-teal-700 transition hover:text-teal-900"
            >
              Abrir pre-venda
            </Link>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Conteudo final</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-900">
            {document.content}
          </pre>
        </section>
      </div>
    </>
  );
}
