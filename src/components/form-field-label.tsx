"use client";

type FormFieldRequirement = "required" | "optional" | "conditional" | "legal";

type FormFieldLabelProps = {
  htmlFor?: string;
  label: string;
  requirement?: FormFieldRequirement;
  hint?: string;
};

const requirementMeta: Record<
  FormFieldRequirement,
  { text: string; className: string }
> = {
  required: {
    text: "Obrigatorio",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  optional: {
    text: "Opcional",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  conditional: {
    text: "Condicional",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  legal: {
    text: "Juridico",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

export function FormFieldLabel({
  htmlFor,
  label,
  requirement = "optional",
  hint,
}: FormFieldLabelProps) {
  const meta = requirementMeta[requirement];

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.className}`}
        >
          {meta.text}
        </span>
      </div>
      {hint ? <span className="block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </div>
  );
}
