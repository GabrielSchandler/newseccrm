import type { Metadata } from "next";
import { Eye, RotateCcw, Save } from "lucide-react";
import { TopBar } from "@/components/newsec/top-bar";
import { EditorDashboardsWorkspace } from "@/components/newsec/editor-dashboards-workspace";

export const metadata: Metadata = {
  title: "Personalizar dashboard · NewSec (demonstração)",
};

export default function PersonalizarDashboardPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        companyName="Empresa de demonstração"
        links={[{ href: "/dashboards", label: "← Dashboards" }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ns-border)] px-4 py-3">
        <div>
          <p className="text-xs text-[var(--ns-text-secondary)]">Dashboards / Personalizar</p>
          <h1 className="text-xl font-semibold text-[var(--ns-text)]">Meu painel de gestão</h1>
          <p className="text-xs text-[var(--ns-text-secondary)]">
            Organize os indicadores, defina configurações e personalize a visualização do seu
            painel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--ns-warning)]/15 px-3 py-1.5 text-xs font-medium text-[var(--ns-warning)]">
            Rascunho
          </span>
          <button
            type="button"
            title="Restaurar padrão (demonstração)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Restaurar padrão
          </button>
          <button
            type="button"
            title="Visualizar (demonstração)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
            Visualizar
          </button>
          <button
            type="button"
            title="Salvar (demonstração)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ns-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90"
          >
            <Save aria-hidden="true" className="h-3.5 w-3.5" />
            Salvar
          </button>
        </div>
      </div>

      <EditorDashboardsWorkspace />
    </div>
  );
}
