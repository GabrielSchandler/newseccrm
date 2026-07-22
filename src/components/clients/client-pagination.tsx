import Link from "next/link";

type ClientPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
};

function buildHref(searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value && key !== "success") {
      params.set(key, value);
    }
  });

  params.set("page", String(page));
  return `/clientes?${params.toString()}`;
}

export function ClientPagination({
  page,
  pageSize,
  total,
  searchParams,
}: ClientPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
      <p>
        Mostrando {firstItem}-{lastItem} de {total} clientes
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(searchParams, Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 ${
            page <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Anterior
        </Link>
        <span className="px-2">
          Página {page} de {totalPages}
        </span>
        <Link
          href={buildHref(searchParams, Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 ${
            page >= totalPages ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
