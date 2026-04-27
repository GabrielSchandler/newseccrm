import { formatCalculationStatus } from "@/lib/calculations/formatters";
import type { FinancingCalculationStatus } from "@/types/calculation";

export function CalculationStatusBadge({
  status,
}: {
  status: FinancingCalculationStatus | string | null;
}) {
  const palette =
    status === "pdf_gerado"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${palette}`}
    >
      {formatCalculationStatus(status)}
    </span>
  );
}
