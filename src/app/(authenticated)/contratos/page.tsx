import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import type { Client } from "@/types/client";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";

export default async function ContratosPage() {
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("company_id", companyId)
    .eq("document_type", "contrato")
    .order("created_at", { ascending: false });
  const contracts = (data ?? []) as GeneratedDocument[];
  const clientIds = Array.from(
    new Set(contracts.map((contract) => contract.client_id).filter(Boolean)),
  ) as string[];
  const templateIds = Array.from(
    new Set(contracts.map((contract) => contract.template_id).filter(Boolean)),
  );
  const [{ data: clientsData }, { data: templatesData }] = await Promise.all([
    clientIds.length
      ? supabase
          .from("clients")
          .select("id, full_name")
          .eq("company_id", companyId)
          .in("id", clientIds)
      : Promise.resolve({ data: [] }),
    templateIds.length
      ? supabase
          .from("document_templates")
          .select("id, name")
          .eq("company_id", companyId)
          .in("id", templateIds)
      : Promise.resolve({ data: [] }),
  ]);
  const clients = (clientsData ?? []) as Pick<Client, "id" | "full_name">[];
  const templates = (templatesData ?? []) as Pick<DocumentTemplate, "id" | "name">[];

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Contratos gerados a partir das pre-vendas da empresa."
      />
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Esta tela lista documentos gerados do tipo contrato. A gestao juridica
          completa, assinatura e versionamento podem entrar na proxima etapa.
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Contrato</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contracts.map((contract) => {
                    const client = clients.find((item) => item.id === contract.client_id);
                    const template = templates.find(
                      (item) => item.id === contract.template_id,
                    );

                    return (
                      <tr key={contract.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-950">
                          {displayValue(contract.title)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {displayValue(client?.full_name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {displayValue(template?.name ?? null)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDateTime(contract.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/documentos/gerados/${contract.id}`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Visualizar
                            </Link>
                            <Link
                              href={`/documentos/gerados/${contract.id}/imprimir?print=1`}
                              target="_blank"
                              className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                            >
                              PDF
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!contracts.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                        Nenhum contrato gerado ainda.
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
