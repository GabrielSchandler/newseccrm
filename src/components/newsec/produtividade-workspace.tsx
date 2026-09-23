import { Activity, CheckCircle2, Clock, Target } from "lucide-react";
import {
  aplicativosDemo,
  cardsProdutividadeDemo,
  distribuicaoJornadaDemo,
  pessoasEquipeDemo,
} from "@/lib/demo/produtividade-data";
import { StatCard } from "./stat-card";

const ICONES = [Clock, Activity, CheckCircle2, Target];

export function ProdutividadeWorkspace() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-hover)] px-3 py-2 text-xs text-[var(--ns-text-secondary)]">
        Dados ilustrativos. Atividade no computador e resultado comercial são indicadores distintos — use também
        indicadores de negócio para uma análise completa.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cardsProdutividadeDemo.map((card, index) => (
          <StatCard key={card.rotulo} icon={ICONES[index]} label={card.rotulo} value={card.valor} hint="Média por pessoa" />
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Distribuição da jornada</h2>
        <div className="flex h-8 w-full overflow-hidden rounded-lg">
          {distribuicaoJornadaDemo.map((fatia) => (
            <div
              key={fatia.categoria}
              className="flex items-center justify-center text-[11px] font-medium text-white"
              style={{ width: `${fatia.percent}%`, backgroundColor: fatia.cor }}
              title={`${fatia.categoria}: ${fatia.percent}%`}
            >
              {fatia.percent >= 8 ? `${fatia.percent}%` : ""}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {distribuicaoJornadaDemo.map((fatia) => (
            <div key={fatia.categoria} className="flex items-center gap-1.5 text-xs text-[var(--ns-text-secondary)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fatia.cor }} />
              {fatia.categoria}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Aplicativos e sites</h2>
          <ul className="space-y-2">
            {aplicativosDemo.map((app) => (
              <li key={app.nome} className="flex items-center justify-between text-sm">
                <span className="text-[var(--ns-text)]">{app.nome}</span>
                <span className="text-[var(--ns-text-secondary)]">{app.tempo}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]">
          <div className="border-b border-[var(--ns-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--ns-text)]">Pessoas da equipe</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ns-border)] text-xs text-[var(--ns-text-secondary)]">
                <th className="px-4 py-2 font-medium">Pessoa</th>
                <th className="px-4 py-2 font-medium">Jornada</th>
                <th className="px-4 py-2 font-medium">Ativo</th>
                <th className="px-4 py-2 font-medium">Produtivo</th>
                <th className="px-4 py-2 font-medium">Ocioso</th>
                <th className="px-4 py-2 font-medium">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {pessoasEquipeDemo.map((pessoa) => (
                <tr key={pessoa.nome} className="border-b border-[var(--ns-border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-[10px] font-semibold text-[var(--ns-primary)]">
                        {pessoa.iniciais}
                      </div>
                      <span className="font-medium text-[var(--ns-text)]">{pessoa.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{pessoa.jornada}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{pessoa.ativo}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{pessoa.produtivo}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{pessoa.ocioso}</td>
                  <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{pessoa.cobertura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
