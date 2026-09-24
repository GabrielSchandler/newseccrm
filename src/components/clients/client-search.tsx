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
    <form className="ns-card w-full p-4">
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-secondary)]" />
          <input
            name="q"
            defaultValue={defaultValues?.q}
            placeholder="Buscar por nome ou CPF"
            className="ns-input pl-10"
          />
        </div>
        <input name="phone" defaultValue={defaultValues?.phone} placeholder="Buscar por telefone" className="ns-input" />
        <div className="flex gap-2">
          <button type="submit" className="ns-btn-secondary flex-1">
            Buscar
          </button>
          <Link href="/clientes" className="ns-btn-secondary">
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </Link>
        </div>
      </div>

      <details className="mt-4">
        <summary className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-[var(--ns-primary)]">
          <Filter className="h-4 w-4" />
          Filtro avancado
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <select name="status" defaultValue={defaultValues?.status ?? "active"} className="ns-input">
            <option value="active">Ativos</option>
            <option value="deleted">Excluidos</option>
            <option value="all">Todos</option>
          </select>
          <select name="hasEmail" defaultValue={defaultValues?.hasEmail ?? "all"} className="ns-input">
            <option value="all">Email: todos</option>
            <option value="yes">Com email</option>
            <option value="no">Sem email</option>
          </select>
          <input name="city" defaultValue={defaultValues?.city} placeholder="Cidade" className="ns-input" />
          <input
            name="state"
            defaultValue={defaultValues?.state}
            placeholder="UF"
            maxLength={2}
            className="ns-input uppercase"
          />
          <select name="sort" defaultValue={defaultValues?.sort ?? "created_desc"} className="ns-input">
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
          <select name="pageSize" defaultValue={defaultValues?.pageSize ?? "20"} className="ns-input">
            <option value="20">20 por página</option>
            <option value="50">50 por página</option>
          </select>
        </div>
      </details>
    </form>
  );
}
