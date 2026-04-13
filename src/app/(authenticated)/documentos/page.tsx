import Link from "next/link";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import type { PreSaleClientSnapshot } from "@/types/pre-sale";

type SnapshotRow = Pick<PreSaleClientSnapshot, "pre_sale_id" | "full_name">;

export default async function DocumentosPage() {
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const documents = (data ?? []) as GeneratedDocument[];
  const templateIds = Array.from(new Set(documents.map((document) => document.template_id)));
  const preSaleIds = Array.from(new Set(documents.map((document) => document.pre_sale_id)));

  const [{ data: templatesData }, { data: snapshotsData }] = await Promise.all([
    templateIds.length
      ? supabase.from("document_templates").select("*").in("id", templateIds)
      : Promise.resolve({ data: [] }),
    preSaleIds.length
      ? supabase
          .from("pre_sale_client_snapshot")
          .select("pre_sale_id, full_name")
          .in("pre_sale_id", preSaleIds)
      : Promise.resolve({ data: [] }),
  ]);
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const snapshots = (snapshotsData ?? []) as SnapshotRow[];

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Consulte documentos gerados a partir das pre-vendas."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => {
                    const template = templates.find(
                      (item) => item.id === document.template_id,
                    );
                    const snapshot = snapshots.find(
                      (item) => item.pre_sale_id === document.pre_sale_id,
                    );

                    return (
                      <tr key={document.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {displayValue(template?.name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {displayValue(snapshot?.full_name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDateTime(document.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/documentos/${document.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Visualizar
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {!documents.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
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
