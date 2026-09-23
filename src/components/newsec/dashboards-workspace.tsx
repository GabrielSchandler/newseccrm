import { AlertTriangle, Clock } from "lucide-react";
import {
  cardsGestaoDemo,
  desempenhoEquipeDemo,
  funilComercialDemo,
  insightsGestaoDemo,
  vendasPorSemanaDemo,
} from "@/lib/demo/dashboards-data";

export function DashboardsWorkspace() {
  const maiorVenda = Math.max(...vendasPorSemanaDemo.map((s) => s.valor));
  const maiorFunil = Math.max(...funilComercialDemo.map((f) => f.valor));

  return (
    <div className="flex-1 overflow-y-auto p-4">
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
          <h2 className="mb-1 text-sm font-semibold text-[var(--ns-text)]">Vendas por semana</h2>
          <p className="mb-4 text-xs text-[var(--ns-text-secondary)]">Evolução do valor de vendas no período.</p>
          <div className="flex h-40 items-end gap-4">
            {vendasPorSemanaDemo.map((semana) => (
              <div key={semana.semana} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs text-[var(--ns-text-secondary)]">
                  {(semana.valor / 1000).toFixed(0)}k
                </span>
                {/* Altura em px, nao %: o pai (esta coluna) nao tem altura
                    fixa propria, so a altura combinada do conteudo — uma
                    altura em % aqui resolveria contra "nada" e a barra
                    sumiria. */}
                <div
                  className="w-full rounded-t-md bg-[var(--ns-primary)]"
                  style={{ height: `${Math.max((semana.valor / maiorVenda) * 110, 4)}px` }}
                />
                <span className="text-xs text-[var(--ns-text-secondary)]">{semana.semana}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <h2 className="mb-1 text-sm font-semibold text-[var(--ns-text)]">Jornada comercial</h2>
          <p className="mb-4 text-xs text-[var(--ns-text-secondary)]">Volume de oportunidades em cada etapa do funil.</p>
          <div className="space-y-2">
            {funilComercialDemo.map((etapa) => (
              <div key={etapa.etapa} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-[var(--ns-text-secondary)]">{etapa.etapa}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--ns-surface-hover)]">
                  <div
                    className="flex h-full items-center rounded-md bg-[var(--ns-primary)] px-2 text-[11px] font-medium text-[var(--ns-primary-foreground)]"
                    style={{ width: `${Math.max((etapa.valor / maiorFunil) * 100, 18)}%` }}
                  >
                    {etapa.valor}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ns-text-secondary)]">
            Os números representam volumes do período — não devem ser interpretados como taxa de conversão entre
            etapas de períodos diferentes.
          </p>
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
          <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Insights</h2>
          <ul className="space-y-2">
            {insightsGestaoDemo.map((insight) => {
              const Icon = insight.tipo === "alerta" ? AlertTriangle : Clock;
              return (
                <li
                  key={insight.id}
                  className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                    insight.tipo === "alerta"
                      ? "border-[var(--ns-danger)]/30 bg-[var(--ns-danger)]/10"
                      : "border-[var(--ns-warning)]/30 bg-[var(--ns-warning)]/10"
                  }`}
                >
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
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
