import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "warning" | "success" | "danger";
}) {
  const accentClass = {
    primary: "bg-[var(--ns-primary)]/15 text-[var(--ns-primary)]",
    warning: "bg-[var(--ns-warning)]/15 text-[var(--ns-warning)]",
    success: "bg-[var(--ns-success)]/15 text-[var(--ns-success)]",
    danger: "bg-[var(--ns-danger)]/15 text-[var(--ns-danger)]",
  }[accent];

  return (
    <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-[var(--ns-text-secondary)]">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[var(--ns-text)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ns-text-secondary)]">{hint}</p>}
    </div>
  );
}
