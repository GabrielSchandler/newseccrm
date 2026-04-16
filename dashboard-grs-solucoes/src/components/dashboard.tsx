"use client";

import { useEffect, useMemo, useState } from "react";

type Equipe = "COMERCIAL" | "JURIDICO";

type Venda = {
  nome: string;
  data: string;
  cliente: string;
  meta: number;
  equipe: Equipe;
};

type ApiResponse = {
  vendas: Venda[];
  meta: number;
  refreshSeconds: number;
  updatedAt: string;
  source: string;
};

type ApiState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "success"; data: ApiResponse; error?: never }
  | { status: "error"; data?: never; error: string };

type Ranking = {
  nome: string;
  total: number;
  vendas: number;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const shortCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [state, setState] = useState<ApiState>({ status: "loading" });

  async function load() {
    try {
      const response = await fetch("/api/vendas", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel carregar os dados.");
      }

      setState({ status: "success", data: payload });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const refreshMs = Math.max(state.data.refreshSeconds, 60) * 1000;
    const timer = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(timer);
  }, [state]);

  if (state.status === "loading") {
    return (
      <main className="shell">
        <Header />
        <section className="notice">Carregando dados da planilha...</section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="shell">
        <Header />
        <section className="notice noticeError">
          <h2>Conexao com a planilha pendente</h2>
          <p>{state.error}</p>
          <p>
            Configure as variaveis de ambiente na Vercel para conectar o SharePoint.
          </p>
        </section>
      </main>
    );
  }

  return <DashboardReady data={state.data} onRefresh={load} />;
}

function DashboardReady({
  data,
  onRefresh,
}: {
  data: ApiResponse;
  onRefresh: () => void;
}) {
  const comercial = data.vendas.filter((venda) => venda.equipe === "COMERCIAL");
  const juridico = data.vendas.filter((venda) => venda.equipe === "JURIDICO");
  const totalComercial = sum(comercial);
  const totalJuridico = sum(juridico);
  const total = totalComercial + totalJuridico;
  const falta = Math.max(data.meta - total, 0);
  const pct = Math.min((total / data.meta) * 100, 100);
  const week = getWeekBounds();
  const semanaComercial = comercial.filter(
    (venda) => venda.data >= week.start && venda.data <= week.end,
  );
  const semanaJuridico = juridico.filter(
    (venda) => venda.data >= week.start && venda.data <= week.end,
  );

  const rankComercial = useMemo(() => rankBySeller(comercial), [comercial]);
  const rankJuridico = useMemo(() => rankBySeller(juridico), [juridico]);
  const rankComercialSemana = useMemo(
    () => rankBySeller(semanaComercial),
    [semanaComercial],
  );
  const rankJuridicoSemana = useMemo(() => rankBySeller(semanaJuridico), [semanaJuridico]);

  return (
    <main className="shell">
      <Header updatedAt={data.updatedAt} source={data.source} onRefresh={onRefresh} />

      <section className="metrics" aria-label="Resumo">
        <Metric label="Total vendido" value={currency.format(total)} highlight />
        <Metric label="Comercial" value={currency.format(totalComercial)} />
        <Metric label="Juridico" value={currency.format(totalJuridico)} />
        <Metric label="Vendas" value={String(data.vendas.length)} />
        <Metric label="Falta para meta" value={currency.format(falta)} muted={falta === 0} />
      </section>

      <section className="goal">
        <div>
          <p>Meta do mes</p>
          <strong>{pct.toFixed(1)}%</strong>
        </div>
        <div className="progress" aria-label={`Meta em ${pct.toFixed(1)}%`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <footer>
          <span>{currency.format(total)}</span>
          <span>{currency.format(data.meta)}</span>
        </footer>
      </section>

      <section className="split">
        <ChartPanel title="Faturamento comercial por vendedor" ranking={rankComercial} />
        <ChartPanel title="Faturamento juridico por vendedor" ranking={rankJuridico} />
      </section>

      <section className="split">
        <RankingPanel title="Ranking mensal comercial" ranking={rankComercial} />
        <RankingPanel title="Ranking mensal juridico" ranking={rankJuridico} />
      </section>

      <section className="split">
        <RankingPanel title="Ranking semanal comercial" ranking={rankComercialSemana} />
        <RankingPanel title="Ranking semanal juridico" ranking={rankJuridicoSemana} />
      </section>

      <section className="split">
        <DayPanel title="Comercial por dia" vendas={comercial} />
        <DayPanel title="Juridico por dia" vendas={juridico} />
      </section>

      <section className="sales">
        <h2>Ultimas vendas</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Equipe</th>
                <th>Vendedor</th>
                <th>Cliente</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {[...data.vendas]
                .sort((a, b) => b.data.localeCompare(a.data))
                .slice(0, 20)
                .map((venda) => (
                  <tr key={`${venda.equipe}-${venda.data}-${venda.nome}-${venda.cliente}`}>
                    <td>{formatDate(venda.data)}</td>
                    <td>{venda.equipe}</td>
                    <td>{venda.nome}</td>
                    <td>{venda.cliente}</td>
                    <td>{currency.format(venda.meta)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Header({
  updatedAt,
  source,
  onRefresh,
}: {
  updatedAt?: string;
  source?: string;
  onRefresh?: () => void;
}) {
  return (
    <header className="header">
      <div className="brandMark">
        <strong>GRS</strong>
        <span>SOLUCOES</span>
      </div>
      <div>
        <h1>Dashboard de Vendas</h1>
        <p>Comercial, juridico, meta, ranking e faturamento diario</p>
      </div>
      <div className="headerMeta">
        {updatedAt ? (
          <>
            <span>{new Date(updatedAt).toLocaleString("pt-BR")}</span>
            <small>{source}</small>
          </>
        ) : (
          <span>Atualizacao automatica</span>
        )}
        {onRefresh ? (
          <button type="button" onClick={onRefresh}>
            Atualizar
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong className={highlight ? "red" : muted ? "muted" : ""}>{value}</strong>
    </article>
  );
}

function RankingPanel({ title, ranking }: { title: string; ranking: Ranking[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <RankingTable ranking={ranking} />
    </section>
  );
}

function RankingTable({ ranking }: { ranking: Ranking[] }) {
  const max = ranking[0]?.total ?? 1;

  if (ranking.length === 0) {
    return <p className="empty">Sem vendas no periodo.</p>;
  }

  return (
    <div className="ranking">
      {ranking.map((item, index) => (
        <div className="rankRow" key={item.nome}>
          <span className="rankBadge">{index + 1}</span>
          <strong>{item.nome}</strong>
          <small>{item.vendas} vendas</small>
          <span>{currency.format(item.total)}</span>
          <i style={{ width: `${Math.max((item.total / max) * 100, 4)}%` }} />
        </div>
      ))}
    </div>
  );
}

function ChartPanel({ title, ranking }: { title: string; ranking: Ranking[] }) {
  const max = ranking[0]?.total ?? 1;

  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="bars">
        {ranking.map((item) => (
          <div className="barLine" key={item.nome}>
            <span>{item.nome}</span>
            <div>
              <i style={{ width: `${Math.max((item.total / max) * 100, 3)}%` }} />
            </div>
            <strong>{shortCurrency.format(item.total)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DayPanel({ title, vendas }: { title: string; vendas: Venda[] }) {
  const days = groupByDate(vendas);
  const max = Math.max(...days.map((day) => day.total), 1);

  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="days">
        {days.map((day) => (
          <div className="dayLine" key={day.data}>
            <span>{formatDate(day.data)}</span>
            <div>
              <i style={{ width: `${Math.max((day.total / max) * 100, 3)}%` }} />
            </div>
            <strong>{shortCurrency.format(day.total)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function sum(vendas: Venda[]) {
  return vendas.reduce((total, venda) => total + venda.meta, 0);
}

function rankBySeller(vendas: Venda[]): Ranking[] {
  const map = new Map<string, Ranking>();

  for (const venda of vendas) {
    const current = map.get(venda.nome) ?? {
      nome: venda.nome,
      total: 0,
      vendas: 0,
    };

    current.total += venda.meta;
    current.vendas += 1;
    map.set(venda.nome, current);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function groupByDate(vendas: Venda[]) {
  const map = new Map<string, { data: string; total: number }>();

  for (const venda of vendas) {
    const current = map.get(venda.data) ?? {
      data: venda.data,
      total: 0,
    };

    current.total += venda.meta;
    map.set(venda.data, current);
  }

  return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
