import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Globe,
  Info,
  Monitor,
  Play,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  abasProdutividadeDemo,
  aplicativosDemo,
  cardsProdutividadeDemo,
  distribuicaoJornadaDemo,
  pessoasEquipeDemo,
} from "@/lib/demo/produtividade-data";
import { FiltroPill } from "./filtro-pill";
import { StatCard } from "./stat-card";

const ICONES_CARD = [Clock, Play, BarChart3, Target] as const;
const ACENTOS_CARD = ["primary", "success", "warning", "info"] as const;

const ICONES_APP = [Users, FileSpreadsheet, Globe] as const;
const CORES_APP = ["bg-[var(--ns-primary)]/15 text-[var(--ns-primary)]", "bg-[var(--ns-success)]/15 text-[var(--ns-success)]", "bg-[var(--ns-text-secondary)]/15 text-[var(--ns-text-secondary)]"];

const CORES_AVATAR = ["#8b5cf6", "#f97316", "#16a34a", "#f97316", "#ec4899"];

export function ProdutividadeWorkspace() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ns-text)]">Produtividade</h1>
          <p className="text-xs text-[var(--ns-text-secondary)]">Atividade, jornada e resultados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Exportar (demonstração)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Exportar
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ns-text-secondary)]" />
          </button>
          <button
            type="button"
            title="Dispositivos (demonstração)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            <Monitor aria-hidden="true" className="h-3.5 w-3.5" />
            Dispositivos
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 border-b border-[var(--ns-border)]">
        {abasProdutividadeDemo.map((aba, index) => (
          <button
            key={aba}
            type="button"
            title="Aba (demonstração)"
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${
              index === 0
                ? "border-[var(--ns-primary)] text-[var(--ns-primary)]"
                : "border-transparent text-[var(--ns-text-secondary)] hover:text-[var(--ns-text)]"
            }`}
          >
            {aba}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltroPill label="Últimos 7 dias" />
        <FiltroPill label="Equipe comercial" />
        <FiltroPill label="Todas as pessoas" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cardsProdutividadeDemo.map((card, index) => (
          <StatCard
            key={card.rotulo}
            icon={ICONES_CARD[index]}
            label={card.rotulo}
            value={card.valor}
            hint="Média por pessoa • dados ilustrativos"
            accent={ACENTOS_CARD[index]}
          />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Distribuição da jornada</h2>
          <div className="flex h-8 w-full overflow-hidden rounded-lg">
            {distribuicaoJornadaDemo.map((fatia) => (
              <div
                key={fatia.categoria}
                className={`flex items-center justify-center text-[11px] font-medium ${
                  fatia.categoria === "Sem dados" ? "text-[var(--ns-text)]" : "text-white"
                }`}
                style={{ width: `${fatia.percent}%`, backgroundColor: fatia.cor }}
                title={`${fatia.categoria}: ${fatia.percent}%`}
              >
                {fatia.percent}%
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
          <p className="mt-2 text-xs text-[var(--ns-text-secondary)]">Média por pessoa • dados ilustrativos</p>
        </div>

        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Aplicativos e sites</h2>
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--ns-text-secondary)]">
            <span>Aplicativo / Site</span>
            <span>Tempo (média por pessoa)</span>
          </div>
          <ul className="space-y-2.5">
            {aplicativosDemo.map((app, index) => {
              const Icon = ICONES_APP[index % ICONES_APP.length];
              return (
                <li key={app.nome} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${CORES_APP[index % CORES_APP.length]}`}>
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[var(--ns-text)]">{app.nome}</span>
                  </span>
                  <span className="text-[var(--ns-text-secondary)]">{app.tempo}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]">
        <div className="border-b border-[var(--ns-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--ns-text)]">Pessoas da equipe</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--ns-border)] text-xs text-[var(--ns-text-secondary)]">
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Pessoa <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Jornada <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Ativo <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Produtivo <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Ocioso <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Cobertura <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pessoasEquipeDemo.map((pessoa, index) => (
              <tr key={pessoa.nome} className="border-b border-[var(--ns-border)] last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: CORES_AVATAR[index % CORES_AVATAR.length] }}
                    >
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
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    title="Ver detalhes (demonstração)"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                  >
                    Ver detalhes
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-primary)]/5 p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)] text-white">
            <Info aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs">
            <span className="font-semibold text-[var(--ns-text)]">
              Atividade no computador e resultado comercial são indicadores distintos.
            </span>{" "}
            <span className="text-[var(--ns-text-secondary)]">
              O tempo de uso de aplicativos mostra o nível de atividade, mas não necessariamente o
              impacto nos resultados. Utilize também indicadores de negócio para uma análise completa.
            </span>
          </p>
        </div>
        <button
          type="button"
          title="Fechar (demonstração)"
          aria-label="Fechar aviso"
          className="shrink-0 rounded-lg p-1 text-[var(--ns-text-secondary)] transition hover:bg-[var(--ns-surface-hover)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
