import { Filter, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

type ClientSearchProps = {
  defaultValues?: {
    q?: string;
    phone?: string;
    status?: string;
    city?: string;
    state?: string;
    hasEmail?: string;
    sort?: string;
    pageSize?: string;
  };
};

export function ClientSearch({ defaultValues }: ClientSearchProps) {
  return (
    <form className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={defaultValues?.q}
            placeholder="Buscar por nome ou CPF"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <input
          name="phone"
          defaultValue={defaultValues?.phone}
          placeholder="Buscar por telefone"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Buscar
          </button>
          <Link
            href="/clientes"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </Link>
        </div>
      </div>

      <details className="mt-4">
        <summary className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-teal-700">
          <Filter className="h-4 w-4" />
          Filtro avancado
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <select
            name="status"
            defaultValue={defaultValues?.status ?? "active"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            <option value="active">Ativos</option>
            <option value="deleted">Excluidos</option>
            <option value="all">Todos</option>
          </select>
          <select
            name="hasEmail"
            defaultValue={defaultValues?.hasEmail ?? "all"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            <option value="all">Email: todos</option>
            <option value="yes">Com email</option>
            <option value="no">Sem email</option>
          </select>
          <input
            name="city"
            defaultValue={defaultValues?.city}
            placeholder="Cidade"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
          <input
            name="state"
            defaultValue={defaultValues?.state}
            placeholder="UF"
            maxLength={2}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
          <select
            name="sort"
            defaultValue={defaultValues?.sort ?? "created_desc"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            <option value="created_desc">Mais recentes</option>
            <option value="created_asc">Mais antigos</option>
            <option value="name_asc">Nome A-Z</option>
            <option value="name_desc">Nome Z-A</option>
            <option value="city_asc">Cidade A-Z</option>
            <option value="city_desc">Cidade Z-A</option>
            <option value="state_asc">UF A-Z</option>
            <option value="state_desc">UF Z-A</option>
            <option value="cpf_asc">CPF crescente</option>
            <option value="cpf_desc">CPF decrescente</option>
            <option value="phone_asc">Telefone crescente</option>
            <option value="phone_desc">Telefone decrescente</option>
          </select>
          <select
            name="pageSize"
            defaultValue={defaultValues?.pageSize ?? "20"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          >
            <option value="20">20 por página</option>
            <option value="50">50 por página</option>
          </select>
        </div>
      </details>
    </form>
  );
}
