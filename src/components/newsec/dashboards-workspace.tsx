import Link from "next/link";
import { AlertTriangle, Clock, Info, Settings2 } from "lucide-react";
import {
  cardsGestaoDemo,
  desempenhoEquipeDemo,
  funilComercialDemo,
  insightsGestaoDemo,
  vendasPorSemanaDemo,
} from "@/lib/demo/dashboards-data";
import { FiltroPill } from "./filtro-pill";

const CORES_FUNIL = ["#3b82f6", "#8b5cf6", "#c4b5fd", "#34d399"];

function formatarReais(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR")}`;
}

export function DashboardsWorkspace() {
  const maiorVenda = Math.max(...vendasPorSemanaDemo.map((s) => s.valor));
  const maiorFunil = Math.max(...funilComercialDemo.map((f) => f.valor));
  const escalaY = [0, 0.25, 0.5, 0.75, 1].map((fator) => Math.round((maiorVenda * fator) / 1000) * 1000);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ns-text)]">Visão da empresa</h1>
          <p className="text-xs text-[var(--ns-text-secondary)]">
            Acompanhe os principais indicadores e o desempenho das equipes em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroPill label="Este mês" />
          <FiltroPill label="Todas as equipes" />
          <FiltroPill label="Comercial e Jurídico" />
          <Link
            href="/dashboards/personalizar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-primary)] bg-[var(--ns-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--ns-primary)] transition hover:bg-[var(--ns-primary)]/15"
          >
            <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
            Personalizar
          </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {cardsGestaoDemo.map((card) => (
          <div key={card.rotulo} className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-3.5">
            <p className="text-xs font-medium text-[var(--ns-text-secondary)]">{card.rotulo}</p>
            <p className="mt-1 text-xl font-semibold text-[var(--ns-text)]">{card.valor}</p>
            <p
              className={`mt-1 text-xs font-medium ${
                card.tendencia === "atencao" ? "text-[var(--ns-warning)]" : "text-[var(--ns-success)]"
              }`}
            >
              {card.variacao} vs. mês anterior
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ns-text)]">Vendas por semana</h2>
              <p className="text-xs text-[var(--ns-text-secondary)]">Evolução do valor de vendas no período.</p>
            </div>
            <FiltroPill label="Valor de vendas" />
          </div>
          <div className="flex gap-2">
            <div className="flex h-40 flex-col justify-between text-right text-[10px] text-[var(--ns-text-secondary)]">
              {[...escalaY].reverse().map((valor) => (
                <span key={valor}>{formatarReais(valor)}</span>
              ))}
            </div>
            <div className="flex h-40 flex-1 items-end gap-4 border-l border-[var(--ns-border)] pl-3">
              {vendasPorSemanaDemo.map((semana) => (
                <div key={semana.semana} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] font-medium text-[var(--ns-text)]">
                    {formatarReais(semana.valor)}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-[var(--ns-primary)]"
                    style={{ height: `${Math.max((semana.valor / maiorVenda) * 110, 4)}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-2 pl-[52px]">
            {vendasPorSemanaDemo.map((semana) => (
              <span key={semana.semana} className="flex-1 text-center text-xs text-[var(--ns-text-secondary)]">
                {semana.semana}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ns-text)]">Jornada comercial</h2>
              <p className="text-xs text-[var(--ns-text-secondary)]">Volume de oportunidades em cada etapa do funil.</p>
            </div>
            <FiltroPill label="Este mês" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              {funilComercialDemo.map((etapa, index) => {
                const percentLargura = Math.max((etapa.valor / maiorFunil) * 100, 30);
                const recuo = (100 - percentLargura) / 2;
                return (
                  <div key={etapa.etapa} className="flex items-center justify-center">
                    <div
                      className="flex h-14 items-center justify-between px-4 text-sm font-medium text-white"
                      style={{
                        width: `${percentLargura}%`,
                        backgroundColor: CORES_FUNIL[index % CORES_FUNIL.length],
                        clipPath:
                          index === funilComercialDemo.length - 1
                            ? "polygon(4% 0, 96% 0, 96% 100%, 4% 100%)"
                            : "polygon(0 0, 100% 0, 96% 100%, 4% 100%)",
                        marginLeft: `${recuo * 0.15}%`,
                      }}
                    >
                      <span>{etapa.etapa}</span>
                      <span>{etapa.valor}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden w-40 shrink-0 items-start gap-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-hover)] p-2.5 text-[11px] text-[var(--ns-text-secondary)] sm:flex">
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Os números representam volumes do período — não devem ser interpretados como taxa de
              conversão entre etapas de períodos diferentes.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]">
          <div className="border-b border-[var(--ns-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--ns-text)]">Desempenho por equipe</h2>
            <p className="text-xs text-[var(--ns-text-secondary)]">Volume de atividades e nível de resposta.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ns-border)] text-xs text-[var(--ns-text-secondary)]">
                <th className="px-4 py-2 font-medium">Equipe</th>
                <th className="px-4 py-2 font-medium">Novos contatos</th>
                <th className="px-4 py-2 font-medium">Pré-vendas</th>
                <th className="px-4 py-2 font-medium">Vendas</th>
                <th className="px-4 py-2 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {desempenhoEquipeDemo.map((linha) => (
                <tr key={linha.equipe} className="border-b border-[var(--ns-border)] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[var(--ns-text)]">{linha.equipe}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{linha.novosContatos}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{linha.preVendas}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{linha.vendas ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{linha.sla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ns-text)]">Insights</h2>
              <p className="text-xs text-[var(--ns-text-secondary)]">
                Pontos de atenção pra manter a operação no ritmo certo.
              </p>
            </div>
            <button
              type="button"
              title="Ver todos (demonstração)"
              className="text-xs font-medium text-[var(--ns-primary)] hover:underline"
            >
              Ver todos →
            </button>
          </div>
          <ul className="space-y-2">
            {insightsGestaoDemo.map((insight) => {
              const Icon = insight.tipo === "alerta" ? AlertTriangle : Clock;
              return (
                <li
                  key={insight.id}
                  className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 ${
                    insight.tipo === "alerta"
                      ? "border-[var(--ns-danger)]/30 bg-[var(--ns-danger)]/10"
                      : "border-[var(--ns-warning)]/30 bg-[var(--ns-warning)]/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      aria-hidden="true"
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        insight.tipo === "alerta" ? "text-[var(--ns-danger)]" : "text-[var(--ns-warning)]"
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--ns-text)]">{insight.titulo}</p>
                      <p className="text-xs text-[var(--ns-text-secondary)]">{insight.descricao}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Demonstração"
                    className="shrink-0 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                  >
                    {insight.tipo === "alerta" ? "Ver conversas" : "Ver lista"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
