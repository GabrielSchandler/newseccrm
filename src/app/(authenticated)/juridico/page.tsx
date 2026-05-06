import Link from "next/link";
import { GenerateDocumentModal } from "@/components/documents/generate-document-modal";
import { PageHeader } from "@/components/layout/page-header";
import { LegalStageSelect } from "@/components/legal/legal-stage-select";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  displayValue,
  formatDate,
  formatDateTime,
} from "@/lib/clients/formatters";
import {
  getLegalWorkflowStage,
  legalWorkflowStages,
  normalizeLegalWorkflowStage,
  type LegalWorkflowStage,
} from "@/lib/legal/workflow";
import { formatCurrency, formatUserName } from "@/lib/pre-sales/formatters";
import type { DocumentTemplate, GeneratedDocument } from "@/types/document";
import type { ClientOption, PreSale, UserProfileOption } from "@/types/pre-sale";

type LegalBoardPreSale = PreSale & {
  client: Pick<ClientOption, "id" | "full_name"> | null;
  consultant: UserProfileOption | null;
  currentLegalStage: LegalWorkflowStage;
  stageUpdatedAt: string;
  generatedDocuments: GeneratedDocument[];
};

function canUseLegalArea(role: string | null, businessArea: string) {
  return role === "admin" || role === "manager" || (role === "seller" && businessArea === "legal");
}

function getStageAgeLabel(isoDate: string) {
  const stageDate = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - stageDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return "Entrou hoje";
  }

  if (diffDays === 1) {
    return "Ha 1 dia";
  }

  return `Ha ${diffDays} dias`;
}

function getStageTemplates(
  templates: DocumentTemplate[],
  stage: LegalWorkflowStage,
) {
  return templates.filter((template) => template.legal_stage === stage);
}

function getPreSaleStageDocuments(
  generatedDocuments: GeneratedDocument[],
  stageTemplates: DocumentTemplate[],
) {
  const stageTemplateIds = new Set(stageTemplates.map((template) => template.id));
  return generatedDocuments.filter((document) => stageTemplateIds.has(document.template_id));
}

export default async function JuridicoPage() {
  const { supabase, companyId, role, businessArea } = await getCurrentUserContext();

  if (!canUseLegalArea(role, businessArea)) {
    return null;
  }

  const [
    { data: preSalesData, error: preSalesError },
    { data: clientsData },
    { data: consultantsData },
    { data: templatesData },
  ] = await Promise.all([
    supabase
      .from("pre_sales")
      .select("*")
      .eq("company_id", companyId)
      .neq("status", "perdido")
      .order("legal_stage_updated_at", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("clients")
      .select("id, full_name")
      .eq("company_id", companyId),
    supabase
      .from("user_profiles")
      .select("id, full_name, username, email, role")
      .eq("company_id", companyId),
    supabase
      .from("document_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const allPreSales = (preSalesData ?? []) as PreSale[];
  const legalPreSalesBase = allPreSales.filter(
    (preSale) => preSale.status === "aprovado" || Boolean(preSale.legal_stage),
  );
  const generatedPreSaleIds = legalPreSalesBase.map((preSale) => preSale.id);

  const [{ data: generatedDocumentsData }] = await Promise.all([
    generatedPreSaleIds.length
      ? supabase
          .from("generated_documents")
          .select("*")
          .eq("company_id", companyId)
          .in("pre_sale_id", generatedPreSaleIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const clients = (clientsData ?? []) as Array<Pick<ClientOption, "id" | "full_name">>;
  const consultants = (consultantsData ?? []) as UserProfileOption[];
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const generatedDocuments = (generatedDocumentsData ?? []) as GeneratedDocument[];

  const legalPreSales: LegalBoardPreSale[] = legalPreSalesBase.map((preSale) => {
    const currentLegalStage = normalizeLegalWorkflowStage(preSale.legal_stage);
    const stageUpdatedAt =
      preSale.legal_stage_updated_at ?? preSale.updated_at ?? preSale.created_at;

    return {
      ...preSale,
      client: clients.find((client) => client.id === preSale.client_id) ?? null,
      consultant:
        consultants.find((consultant) => consultant.id === preSale.consultant_user_id) ??
        null,
      currentLegalStage,
      stageUpdatedAt,
      generatedDocuments: generatedDocuments.filter(
        (document) => document.pre_sale_id === preSale.id,
      ),
    };
  });

  return (
    <>
      <PageHeader
        title="Esteira juridica"
        description="Acompanhe em que fase cada cliente esta, ha quanto tempo e gere os documentos da etapa certa."
      />
      <div className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {legalWorkflowStages.map((stage) => {
            const total = legalPreSales.filter(
              (preSale) => preSale.currentLegalStage === stage.value,
            ).length;

            return (
              <div
                key={stage.value}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {stage.shortLabel}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{total}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {stage.documents.join(", ")}
                </p>
              </div>
            );
          })}
        </section>

        {preSalesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {preSalesError.message}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-5">
          {legalWorkflowStages.map((stage) => {
            const stageTemplates = getStageTemplates(templates, stage.value);
            const stagePreSales = legalPreSales.filter(
              (preSale) => preSale.currentLegalStage === stage.value,
            );

            return (
              <div
                key={stage.value}
                className="flex min-h-[520px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 px-4 py-4">
                  <h2 className="text-sm font-semibold text-slate-950">{stage.label}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {stage.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Templates esperados: {stage.documents.join(" | ")}
                  </p>
                </div>

                <div className="flex-1 space-y-3 p-4">
                  {stagePreSales.length ? (
                    stagePreSales.map((preSale) => {
                      const stageMeta = getLegalWorkflowStage(preSale.currentLegalStage);
                      const stageDocuments = getPreSaleStageDocuments(
                        preSale.generatedDocuments,
                        stageTemplates,
                      );

                      return (
                        <article
                          key={preSale.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-950">
                                {displayValue(preSale.client?.full_name ?? null)}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                {stageMeta.shortLabel} • {getStageAgeLabel(preSale.stageUpdatedAt)}
                              </p>
                            </div>
                            <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                              {stageDocuments.length} docs
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 text-xs text-slate-600">
                            <p>
                              <span className="font-semibold text-slate-700">Consultor:</span>{" "}
                              {formatUserName(preSale.consultant)}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">Valor:</span>{" "}
                              {formatCurrency(preSale.contract_value)}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">Aprovado em:</span>{" "}
                              {formatDateTime(preSale.created_at)}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">Ultima mudanca:</span>{" "}
                              {formatDate(preSale.stageUpdatedAt)}
                            </p>
                          </div>

                          <div className="mt-4">
                            <LegalStageSelect
                              preSaleId={preSale.id}
                              currentStage={preSale.currentLegalStage}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={`/clientes/${preSale.client_id}`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Cliente
                            </Link>
                            <Link
                              href={`/pre-vendas/${preSale.id}`}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Pre-venda
                            </Link>
                            <Link
                              href="/documentos"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Documentos
                            </Link>
                          </div>

                          <div className="mt-4">
                            <GenerateDocumentModal
                              preSaleId={preSale.id}
                              templates={stageTemplates}
                            />
                          </div>

                          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Documentos desta etapa
                            </p>
                            {stageTemplates.length ? (
                              <ul className="space-y-2 text-xs text-slate-700">
                                {stageTemplates.map((template) => {
                                  const documentCreated = stageDocuments.find(
                                    (document) => document.template_id === template.id,
                                  );

                                  return (
                                    <li
                                      key={template.id}
                                      className="flex items-start justify-between gap-3"
                                    >
                                      <div>
                                        <p className="font-medium text-slate-800">
                                          {template.name}
                                        </p>
                                        <p className="text-slate-500">
                                          {documentCreated
                                            ? `Gerado em ${formatDateTime(documentCreated.created_at)}`
                                            : "Ainda nao gerado"}
                                        </p>
                                      </div>
                                      {documentCreated ? (
                                        <Link
                                          href={`/documentos/gerados/${documentCreated.id}`}
                                          className="font-semibold text-teal-700 transition hover:text-teal-800"
                                        >
                                          Abrir
                                        </Link>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-xs leading-5 text-amber-700">
                                Nenhum template desta etapa foi vinculado ainda.
                                Suba os documentos prontos em Templates e marque a etapa
                                juridica correspondente.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Nenhum cliente nesta etapa.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
