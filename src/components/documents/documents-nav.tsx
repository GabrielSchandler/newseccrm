import Link from "next/link";

export function DocumentsNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/documentos"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Documentos gerados
      </Link>
      <Link
        href="/documentos/templates"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Templates
      </Link>
    </div>
  );
}
