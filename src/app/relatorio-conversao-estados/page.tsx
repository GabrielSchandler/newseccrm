import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeDollarSign,
  DatabaseZap,
  FileSpreadsheet,
  MapPinned,
  Scale,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Vendas por UF fiscal | GRS",
  description: "Dashboard estatico com clientes e conversao por UF fiscal do CPF.",
};

type RegionMetric = {
  label: string;
  name: string;
  precise: boolean;
  clients: number;
  commercialClients: number;
  juridicoClients: number;
  total: number;
  commercial: number;
  juridico: number;
  ticketTotal: number;
  ticketComercial: number;
  ticketJuridico: number;
};

const period = "02/02/2026 a 04/05/2026";

const totals = {
  rows: 168,
  clients: 110,
  commercialClients: 94,
  juridicoClients: 42,
  total: 274769.63,
  commercial: 151715.54,
  juridico: 123054.09,
  ticketTotal: 2497.9057272727273,
  ticketComercial: 1613.9951063829787,
  ticketJuridico: 2929.8592857142858,
  preciseStateClients: 47,
};

const regionMetrics: RegionMetric[] = [
  {
    label: "SP",
    name: "Sao Paulo",
    precise: true,
    clients: 35,
    commercialClients: 27,
    juridicoClients: 17,
    total: 86620.07,
    commercial: 41359.25,
    juridico: 45260.82,
    ticketTotal: 2474.859142857143,
    ticketComercial: 1531.8240740740744,
    ticketJuridico: 2662.401176470589,
  },
  {
    label: "MG",
    name: "Minas Gerais",
    precise: true,
    clients: 7,
    commercialClients: 7,
    juridicoClients: 1,
    total: 33623.51,
    commercial: 29554.44,
    juridico: 4069.07,
    ticketTotal: 4803.358571428571,
    ticketComercial: 4222.062857142857,
    ticketJuridico: 4069.07,
  },
  {
    label: "PR/SC",
    name: "Parana ou Santa Catarina",
    precise: false,
    clients: 13,
    commercialClients: 12,
    juridicoClients: 6,
    total: 30409.82,
    commercial: 14445.21,
    juridico: 15964.61,
    ticketTotal: 2339.216923076923,
    ticketComercial: 1203.7675,
    ticketJuridico: 2660.7683333333334,
  },
  {
    label: "CE/MA/PI",
    name: "CE, MA ou PI",
    precise: false,
    clients: 3,
    commercialClients: 3,
    juridicoClients: 2,
    total: 24972.31,
    commercial: 5014.39,
    juridico: 19957.92,
    ticketTotal: 8324.103333333333,
    ticketComercial: 1671.4633333333331,
    ticketJuridico: 9978.96,
  },
  {
    label: "DF/GO/MS/MT/TO",
    name: "Centro-Oeste + Tocantins",
    precise: false,
    clients: 13,
    commercialClients: 11,
    juridicoClients: 4,
    total: 23970.91,
    commercial: 10886.19,
    juridico: 13084.72,
    ticketTotal: 1843.9161538461537,
    ticketComercial: 989.6536363636365,
    ticketJuridico: 3271.18,
  },
  {
    label: "AC/AM/AP/PA/RO/RR",
    name: "Norte fiscal",
    precise: false,
    clients: 9,
    commercialClients: 8,
    juridicoClients: 3,
    total: 19803.47,
    commercial: 13163.57,
    juridico: 6639.9,
    ticketTotal: 2200.385555555555,
    ticketComercial: 1645.44625,
    ticketJuridico: 2213.3,
  },
  {
    label: "AL/PB/PE/RN",
    name: "AL, PB, PE ou RN",
    precise: false,
    clients: 9,
    commercialClients: 6,
    juridicoClients: 5,
    total: 18650.33,
    commercial: 7999.27,
    juridico: 10651.06,
    ticketTotal: 2072.2588888888886,
    ticketComercial: 1333.2116666666668,
    ticketJuridico: 2130.212,
  },
  {
    label: "ES/RJ",
    name: "Espirito Santo ou Rio de Janeiro",
    precise: false,
    clients: 6,
    commercialClients: 5,
    juridicoClients: 2,
    total: 14168.86,
    commercial: 11559.15,
    juridico: 2609.71,
    ticketTotal: 2361.476666666667,
    ticketComercial: 2311.83,
    ticketJuridico: 1304.855,
  },
  {
    label: "BA/SE",
    name: "Bahia ou Sergipe",
    precise: false,
    clients: 9,
    commercialClients: 9,
    juridicoClients: 1,
    total: 11723.86,
    commercial: 10607.28,
    juridico: 1116.58,
    ticketTotal: 1302.6511111111113,
    ticketComercial: 1178.5866666666668,
    ticketJuridico: 1116.58,
  },
  {
    label: "RS",
    name: "Rio Grande do Sul",
    precise: true,
    clients: 5,
    commercialClients: 5,
    juridicoClients: 1,
    total: 10476.49,
    commercial: 6776.79,
    juridico: 3699.7,
    ticketTotal: 2095.298,
    ticketComercial: 1355.358,
    ticketJuridico: 3699.7,
  },
  {
    label: "Sem CPF",
    name: "Sem CPF valido",
    precise: false,
    clients: 1,
    commercialClients: 1,
    juridicoClients: 0,
    total: 350,
    commercial: 350,
    juridico: 0,
    ticketTotal: 350,
    ticketComercial: 350,
    ticketJuridico: 0,
  },
];

const topRegions = regionMetrics.slice(0, 5);
const maxTotal = Math.max(...regionMetrics.map((region) => region.total));

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  icon: typeof BadgeDollarSign;
  tone: "green" | "blue" | "amber" | "rose";
}>) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-tight text-stone-950">
            {value}
          </p>
        </div>
        <span className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{detail}</p>
    </article>
  );
}

function RegionBar({ region }: { region: RegionMetric }) {
  const width = maxTotal ? (region.total / maxTotal) * 100 : 0;

  return (
    <div className="grid gap-3 border-b border-stone-100 py-4 last:border-b-0 md:grid-cols-[210px_1fr_170px] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-stone-950">
            {region.label}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              region.precise
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {region.precise ? "UF exata" : "Grupo fiscal"}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">{region.name}</p>
      </div>

      <div>
        <div className="h-3 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${Math.max(width, 4)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          <span>{formatNumber(region.clients)} clientes</span>
          <span>Comercial {formatNumber(region.commercialClients)}</span>
          <span>Juridico {formatNumber(region.juridicoClients)}</span>
        </div>
      </div>

      <div className="md:text-right">
        <p className="text-sm font-semibold text-stone-950">
          {formatCurrency(region.total)}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          ticket {formatCurrency(region.ticketTotal)}
        </p>
      </div>
    </div>
  );
}

function RegionCards() {
  return (
    <div className="grid gap-3 md:hidden">
      {regionMetrics.map((region) => (
        <article
          key={region.label}
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-stone-950">{region.label}</p>
              <p className="mt-1 text-sm text-stone-500">{region.name}</p>
            </div>
            <p className="text-right text-sm font-semibold text-stone-950">
              {formatCurrency(region.total)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-2 py-1 ${
                region.precise
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {region.precise ? "UF exata" : "Grupo fiscal"}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">
              {formatNumber(region.clients)} clientes
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-stone-500">
                Ticket total
              </dt>
              <dd className="mt-1 font-semibold text-stone-800">
                {formatCurrency(region.ticketTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-stone-500">
                Clientes jur.
              </dt>
              <dd className="mt-1 font-semibold text-stone-800">
                {formatNumber(region.juridicoClients)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-stone-500">
                Comercial
              </dt>
              <dd className="mt-1 font-semibold text-stone-800">
                {formatCurrency(region.ticketComercial)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-stone-500">
                Juridico
              </dt>
              <dd className="mt-1 font-semibold text-stone-800">
                {formatCurrency(region.ticketJuridico)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function RegionTable() {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm md:block">
      <table className="w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-normal text-stone-500">
            <th className="px-4 py-3">UF fiscal</th>
            <th className="px-4 py-3">Clientes</th>
            <th className="px-4 py-3">Total convertido</th>
            <th className="px-4 py-3">Ticket total</th>
            <th className="px-4 py-3">Ticket comercial</th>
            <th className="px-4 py-3">Ticket juridico</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {regionMetrics.map((region) => (
            <tr key={region.label}>
              <td className="px-4 py-3">
                <p className="font-semibold text-stone-950">{region.label}</p>
                <p className="mt-1 text-xs text-stone-500">{region.name}</p>
              </td>
              <td className="px-4 py-3 text-stone-600">
                {formatNumber(region.clients)}
              </td>
              <td className="px-4 py-3 font-semibold text-stone-950">
                {formatCurrency(region.total)}
              </td>
              <td className="px-4 py-3 text-stone-600">
                {formatCurrency(region.ticketTotal)}
              </td>
              <td className="px-4 py-3 text-stone-600">
                {formatCurrency(region.ticketComercial)}
              </td>
              <td className="px-4 py-3 text-stone-600">
                {formatCurrency(region.ticketJuridico)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StateConversionReportPage() {
  const preciseRate = totals.preciseStateClients / totals.clients;

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-stone-950">
      <section className="border-b border-stone-800 bg-[#111513] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.35fr_.65fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              GRS - base de vendas
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl">
              Clientes e conversao por UF fiscal do CPF
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300 sm:text-base">
              Analise feita somente com a aba{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5">
                CONSOLIDADO
              </code>{" "}
              da base de vendas. Valores calculados pelo campo{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5">META</code>,
              por cliente unico.
            </p>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 text-amber-300"
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  Campo de estado nao existe na venda
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  A base de vendas nao tem UF, DDD, cidade ou telefone. Para
                  entregar uma leitura geografica sem leads, usei o 9o digito do
                  CPF, que indica UF ou grupo fiscal.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Clientes unicos"
            value={formatNumber(totals.clients)}
            detail={`${formatNumber(totals.rows)} linhas reais de venda no CONSOLIDADO.`}
            icon={UsersRound}
            tone="green"
          />
          <MetricCard
            label="Total convertido"
            value={formatCurrency(totals.total)}
            detail={`${formatCurrency(totals.commercial)} comercial + ${formatCurrency(totals.juridico)} juridico.`}
            icon={BadgeDollarSign}
            tone="blue"
          />
          <MetricCard
            label="Ticket medio total"
            value={formatCurrency(totals.ticketTotal)}
            detail="Total convertido dividido por todos os clientes unicos."
            icon={TrendingUp}
            tone="amber"
          />
          <MetricCard
            label="Estados exatos"
            value={formatPercent(preciseRate)}
            detail={`${formatNumber(totals.preciseStateClients)} clientes em regioes fiscais de UF unica: SP, MG e RS.`}
            icon={MapPinned}
            tone="rose"
          />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Ticket comercial"
            value={formatCurrency(totals.ticketComercial)}
            detail={`${formatNumber(totals.commercialClients)} clientes com conversao comercial.`}
            icon={FileSpreadsheet}
            tone="green"
          />
          <MetricCard
            label="Ticket juridico"
            value={formatCurrency(totals.ticketJuridico)}
            detail={`${formatNumber(totals.juridicoClients)} clientes com conversao juridica.`}
            icon={Scale}
            tone="amber"
          />
          <MetricCard
            label="Periodo"
            value={period}
            detail="Data minima e maxima encontradas na aba de vendas."
            icon={DatabaseZap}
            tone="blue"
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_.85fr]">
          <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  Top 5 por total convertido
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Ranking por cliente unico, somando comercial e juridico pelo
                  campo META.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                {formatCurrency(topRegions.reduce((sum, item) => sum + item.total, 0))}
              </div>
            </div>
            <div className="mt-3">
              {topRegions.map((region) => (
                <RegionBar key={region.label} region={region} />
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="h-5 w-5 text-emerald-600"
              />
              <h2 className="text-lg font-semibold text-stone-950">
                Como ler esta analise
              </h2>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-6 text-stone-700">
              <p>
                Clientes foram deduplicados por CPF. Quando o CPF nao existe,
                usei nome normalizado como chave de cliente.
              </p>
              <p>
                O CPF permite identificar a regiao fiscal de emissao. SP, MG e
                RS aparecem como UF exata; os demais digitos agrupam mais de um
                estado, entao aparecem como grupo fiscal.
              </p>
              <p>
                Para ter estado real do cliente, a venda precisa registrar UF,
                cidade, DDD ou telefone no proprio CONSOLIDADO.
              </p>
            </div>
          </article>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">
                Clientes, conversao e tickets por UF fiscal
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Tabela completa usando somente a base de vendas.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
              <DatabaseZap aria-hidden="true" className="h-4 w-4 text-stone-500" />
              {formatNumber(totals.clients)} clientes validados
            </div>
          </div>
          <RegionCards />
          <RegionTable />
        </section>
      </div>
    </main>
  );
}
