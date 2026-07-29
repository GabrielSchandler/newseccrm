import type { PreSaleSearchMatch } from "@/types/pre-sale";

type PreSaleSearchMatchBadgesProps = {
  matches?: PreSaleSearchMatch[];
};

function matchFieldLabel(field: PreSaleSearchMatch["field"]) {
  return field === "cpf" ? "CPF" : "nome";
}

export function PreSaleSearchMatchBadges({ matches = [] }: PreSaleSearchMatchBadgesProps) {
  if (!matches.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {matches.map((match) => (
        <span
          key={`${match.source}-${match.field}-${match.value ?? ""}`}
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            match.source === "client"
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          Resultado por {match.label.toLowerCase()} ({matchFieldLabel(match.field)})
        </span>
      ))}
    </div>
  );
}
