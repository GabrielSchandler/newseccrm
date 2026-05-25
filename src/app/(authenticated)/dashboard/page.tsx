import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/clients/formatters";
import { formatCurrency } from "@/lib/pre-sales/formatters";
import type { GeneratedDocument } from "@/types/document";
import {
  isArchivedPreSaleStatus,
  preSaleStatuses,
  type PreSale,
  type PreSaleStatus,
} from "@/types/pre-sale";

type DashboardSearchParams = Promise<{
  area?: string;
  source?: string;
}>;

type DashboardPageProps = {
  searchParams: DashboardSearchParams;
};

type StatCardProps = {
  label: string;
  value: string | number;
  href?: string;
  tone?: "teal" | "blue" | "violet" | "amber";
};

type DashboardArea = "tv" | "operacao" | "gestao" | "marketing";
type MarketingSource = "todos" | "soul" | "growper";
type LeadRow = Record<string, unknown>;

const dashboardAreas: Array<{
  value: DashboardArea;
  label: string;
  description: string;
}> = [
  {
    value: "tv",
    label: "TV",
    description: "Painel rapido para acompanhamento em tela.",
  },
  {
    value: "operacao",
    label: "Operacao",
    description: "Pipeline, atendimentos e andamento das pre-vendas.",
  },
  {
    value: "gestao",
    label: "Gestao",
    description: "Indicadores consolidados para decisao.",
  },
  {
    value: "marketing",
    label: "Marketing",
    description: "Leads captados, origem e qualidade da base.",
  },
];

const marketingSources: Array<{ value: MarketingSource; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "soul", label: "Soul" },
  { value: "growper", label: "Growper" },
];

function StatCard({ label, value, href, tone = "teal" }: StatCardProps) {
  const toneClasses = {
    teal: "hover:border-teal-200 hover:bg-teal-50/50",
    blue: "hover:border-sky-200 hover:bg-sky-50/50",
    violet: "hover:border-fuchsia-200 hover:bg-fuchsia-50/50",
    amber: "hover:border-amber-200 hover:bg-amber-50/50",
  };
  const content = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </>
  );

  if (!href) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition ${toneClasses[tone]}`}
    >
      {content}
    </Link>
  );
}

function SectionBlock({
  title,
  action,
  children,
}: Readonly<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function countByStatus(preSales: PreSale[], status: PreSaleStatus) {
  return preSales.filter((preSale) => preSale.status === status).length;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getLeadField(lead: LeadRow, names: string[]) {
  const wanted = names.map(normalizeText);
  const match = Object.entries(lead).find(([key]) =>
    wanted.includes(normalizeText(key)),
  );

  return match ? String(match[1] ?? "").trim() : "";
}

function getLeadSource(lead: LeadRow): MarketingSource {
  const value = normalizeText(
    getLeadField(lead, ["Origem", "Fonte", "Campanha", "Source", "Empresa"]),
  );

  if (value.includes("soul")) {
    return "soul";
  }

  if (value.includes("growper") || value.includes("group")) {
    return "growper";
  }

  return "todos";
}

function getLeadDate(lead: LeadRow) {
  const value = getLeadField(lead, [
    "Data recebimento",
    "Data formulario",
    "Data formulário",
    "created_at",
    "Criado em",
    "Data",
  ]);
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function isToday(date: Date | null) {
  if (!date) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (!validValues.length) {
    return 0;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function AreaTabs({ activeArea }: { activeArea: DashboardArea }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Areas do dashboard">
      {dashboardAreas.map((area) => {
        const isActive = area.value === activeArea;

        return (
          <Link
            key={area.value}
            href={`/dashboard?area=${area.value}`}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              isActive
                ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50"
            }`}
          >
            <span className="block font-semibold">{area.label}</span>
            <span
              className={`mt-1 block text-xs ${
                isActive ? "text-teal-50" : "text-slate-500"
              }`}
            >
              {area.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function MarketingTabs({
  activeSource,
  counts,
}: {
  activeSource: MarketingSource;
  counts: Record<MarketingSource, number>;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Fontes de marketing">
      {marketingSources.map((source) => {
        const isActive = source.value === activeSource;

        return (
          <Link
            key={source.value}
            href={`/dashboard?area=marketing&source=${source.value}`}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50"
            }`}
          >
            {source.label}
            <span className={isActive ? "ml-2 text-teal-50" : "ml-2 text-slate-400"}>
              {counts[source.value]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function StatusBars({ preSales }: { preSales: PreSale[] }) {
  return (
    <div className="space-y-3">
      {preSaleStatuses.map((status) => {
        const count = countByStatus(preSales, status.value);
        const percentage = preSales.length ? (count / preSales.length) * 100 : 0;

        return (
          <div key={status.value}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{status.label}</span>
              <span className="text-slate-500">{count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentDocuments({ documents }: { documents: GeneratedDocument[] }) {
  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <Link
          key={document.id}
          href={`/documentos/gerados/${document.id}`}
          className="block rounded-lg border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-950">{document.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(document.created_at)}
          </p>
        </Link>
      ))}
      {!documents.length ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Nenhum documento gerado ainda.
        </p>
      ) : null}
    </div>
  );
}

function MarketingPanel({
  leads,
  activeSource,
}: {
  leads: LeadRow[];
  activeSource: MarketingSource;
}) {
  const sourceCounts = leads.reduce<Record<MarketingSource, number>>(
    (counts, lead) => {
      const source = getLeadSource(lead);
      counts[source] += 1;
      counts.todos += source === "todos" ? 0 : 0;

      return counts;
    },
    { todos: leads.length, soul: 0, growper: 0 },
  );
  const filteredLeads =
    activeSource === "todos"
      ? leads
      : leads.filter((lead) => getLeadSource(lead) === activeSource);
  const leadsToday = filteredLeads.filter((lead) => isToday(getLeadDate(lead))).length;
  const financingLeads = filteredLeads.filter((lead) =>
    normalizeText(
      getLeadField(lead, [
        "Possui financiamento ativo",
        "Possui Financiamento Ativo",
        "Financiamento ativo",
      ]),
    ).includes("sim"),
  ).length;
  const averageInstallment = average(
    filteredLeads.map((lead) =>
      parseMoney(
        getLeadField(lead, [
          "Valor da parcela",
          "Valor de Parcela",
          "Parcela",
          "Installment",
        ]),
      ),
    ),
  );
  const latestLeads = filteredLeads.slice(0, 8);

  return (
    <div className="space-y-6">
      <MarketingTabs activeSource={activeSource} counts={sourceCounts} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads recebidos" value={filteredLeads.length} tone="teal" />
        <StatCard label="Leads hoje" value={leadsToday} tone="blue" />
        <StatCard label="Com financiamento" value={financingLeads} tone="violet" />
        <StatCard
          label="Parcela media"
          value={formatCurrency(averageInstallment)}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionBlock title="Leads recentes">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2">Nome</th>
                  <th className="whitespace-nowrap px-3 py-2">WhatsApp</th>
                  <th className="whitespace-nowrap px-3 py-2">Fonte</th>
                  <th className="whitespace-nowrap px-3 py-2">Parcela</th>
                  <th className="whitespace-nowrap px-3 py-2">Banco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latestLeads.map((lead, index) => {
                  const source = getLeadSource(lead);

                  return (
                    <tr key={`${getLeadField(lead, ["CPF", "WhatsApp"])}-${index}`}>
                      <td className="max-w-[220px] px-3 py-3 font-medium text-slate-950">
                        {getLeadField(lead, ["Nome", "Cliente"]) || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {getLeadField(lead, ["WhatsApp", "Telefone", "Celular"]) || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {source === "todos" ? "-" : source.toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {getLeadField(lead, ["Valor da parcela", "Valor de Parcela"]) ||
                          "-"}
                      </td>
                      <td className="max-w-[220px] px-3 py-3 text-slate-600">
                        {getLeadField(lead, [
                          "Banco/Financeira",
                          "Banco Financeira",
                          "Banco",
                        ]) || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!latestLeads.length ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Nenhum lead encontrado para este filtro.
            </p>
          ) : null}
        </SectionBlock>

        <SectionBlock title="Distribuicao por origem">
          <div className="space-y-3">
            {marketingSources.slice(1).map((source) => {
              const count = sourceCounts[source.value];
              const percentage = leads.length ? (count / leads.length) * 100 : 0;

              return (
                <div key={source.value}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{source.label}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-700"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionBlock>
      </section>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const activeArea = dashboardAreas.some((area) => area.value === params.area)
    ? (params.area as DashboardArea)
    : "tv";
  const activeSource = marketingSources.some((source) => source.value === params.source)
    ? (params.source as MarketingSource)
    : "todos";
  const { supabase, companyId } = await getCurrentUserContext();
  const leadsRequest =
    activeArea === "marketing"
      ? supabase
          .from("leads_consolidado")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null });
  const [
    { count: activeClients },
    { data: preSalesData },
    { count: generatedDocuments },
    { data: recentDocumentsData },
    { data: leadsData, error: leadsError },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("pre_sales")
      .select("id, status, contract_value, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("generated_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
    leadsRequest,
  ]);
  const preSales = (preSalesData ?? []) as PreSale[];
  const recentDocuments = (recentDocumentsData ?? []) as GeneratedDocument[];
  const leads = leadsError ? [] : ((leadsData ?? []) as LeadRow[]);
  const openPreSales = preSales.filter(
    (preSale) =>
      preSale.status !== "aprovado" &&
      preSale.status !== "perdido" &&
      !isArchivedPreSaleStatus(preSale.status),
  ).length;
  const approvedValue = preSales
    .filter((preSale) => preSale.status === "aprovado")
    .reduce((total, preSale) => total + Number(preSale.contract_value ?? 0), 0);
  const lostPreSales = countByStatus(preSales, "perdido");
  const conversionRate = preSales.length
    ? `${Math.round((countByStatus(preSales, "aprovado") / preSales.length) * 100)}%`
    : "0%";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visao geral por area: TV, operacao, gestao e marketing."
      />
      <div className="space-y-6 p-6">
        <AreaTabs activeArea={activeArea} />

        {activeArea === "tv" ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Clientes ativos" value={activeClients ?? 0} href="/clientes" />
              <StatCard
                label="Pre-vendas abertas"
                value={openPreSales}
                href="/pre-vendas"
                tone="blue"
              />
              <StatCard
                label="Valor aprovado"
                value={formatCurrency(approvedValue)}
                href="/pre-vendas?status=aprovado"
                tone="amber"
              />
              <StatCard
                label="Leads marketing"
                value={leads.length}
                href="/dashboard?area=marketing"
                tone="violet"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <SectionBlock
                title="Pre-vendas por status"
                action={
                  <Link
                    href="/pre-vendas"
                    className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                  >
                    Ver pipeline
                  </Link>
                }
              >
                <StatusBars preSales={preSales} />
              </SectionBlock>

              <SectionBlock
                title="Documentos recentes"
                action={
                  <Link
                    href="/documentos"
                    className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                  >
                    Ver todos
                  </Link>
                }
              >
                <RecentDocuments documents={recentDocuments} />
              </SectionBlock>
            </section>
          </div>
        ) : null}

        {activeArea === "operacao" ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Em contato" value={countByStatus(preSales, "em_contato")} />
              <StatCard
                label="Em negociacao"
                value={countByStatus(preSales, "em_negociacao")}
                tone="blue"
              />
              <StatCard label="Aprovados" value={countByStatus(preSales, "aprovado")} />
              <StatCard label="Perdidos" value={lostPreSales} tone="amber" />
            </section>
            <SectionBlock title="Pipeline operacional">
              <StatusBars preSales={preSales} />
            </SectionBlock>
          </div>
        ) : null}

        {activeArea === "gestao" ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Clientes ativos" value={activeClients ?? 0} />
              <StatCard label="Conversao" value={conversionRate} tone="blue" />
              <StatCard label="Valor aprovado" value={formatCurrency(approvedValue)} />
              <StatCard label="Documentos gerados" value={generatedDocuments ?? 0} />
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <SectionBlock title="Saude comercial">
                <StatusBars preSales={preSales} />
              </SectionBlock>
              <SectionBlock title="Documentos recentes">
                <RecentDocuments documents={recentDocuments} />
              </SectionBlock>
            </section>
          </div>
        ) : null}

        {activeArea === "marketing" ? (
          <div className="space-y-4">
            {leadsError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Nao foi possivel carregar a tabela leads_consolidado. Confirme se ela
                existe no Supabase e se a conta tem permissao de leitura.
              </p>
            ) : null}
            <MarketingPanel leads={leads} activeSource={activeSource} />
          </div>
        ) : null}
      </div>
    </>
  );
}
