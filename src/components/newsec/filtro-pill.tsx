import { ChevronDown } from "lucide-react";

export function FiltroPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      title="Filtro (demonstração)"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
    >
      {label}
      <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ns-text-secondary)]" />
    </button>
  );
}
