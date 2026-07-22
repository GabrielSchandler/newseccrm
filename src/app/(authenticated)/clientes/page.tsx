import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientList } from "@/components/clients/client-list";
import { ClientPagination } from "@/components/clients/client-pagination";
import { ClientSearch } from "@/components/clients/client-search";
import { ClientToast } from "@/components/clients/client-toast";
import { StatusMessage } from "@/components/clients/status-message";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { onlyDigits } from "@/lib/clients/masks";
import type { ClientListItem } from "@/types/client";

type ClientesPageProps = {
  searchParams: Promise<{
    q?: string;
    phone?: string;
    status?: string;
    city?: string;
    state?: string;
    hasEmail?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    success?: string;
  }>;
};

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const phoneSearch = onlyDigits(params.phone?.trim() ?? "");
  const cpfSearch = onlyDigits(search);
  const status = params.status ?? "active";
  const hasEmail = params.hasEmail ?? "all";
  const sort = params.sort ?? "created_desc";
  const pageSize = params.pageSize === "50" ? 50 : 20;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const offset = (page - 1) * pageSize;
  const shouldIncludeDeleted = Boolean(cpfSearch) || status !== "active";
  const { supabase, companyId } = await getCurrentUserContext();
  const successMessage =
    params.success === "created"
      ? "Cliente cadastrado com sucesso."
      : params.success === "updated"
        ? "Cliente atualizado com sucesso."
        : params.success === "deleted"
          ? "Cliente excluído com sucesso."
          : null;

  let query = supabase
    .from("clients")
    .select("id, full_name, cpf, phone_mobile, city, state, created_at, deleted_at", {
      count: "exact",
    })
    .eq("company_id", companyId);

  if (status === "deleted") {
    query = query.not("deleted_at", "is", null);
  } else if (!shouldIncludeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (search) {
    const filters = [`full_name.ilike.%${search}%`, `cpf.ilike.%${search}%`];

    if (cpfSearch) {
      filters.push(`cpf.ilike.%${cpfSearch}%`);
    }

    query = query.or(filters.join(","));
  }

  if (phoneSearch) {
    query = query.ilike("phone_mobile", `%${phoneSearch}%`);
  }

  if (params.city?.trim()) {
    query = query.ilike("city", `%${params.city.trim()}%`);
  }

  if (params.state?.trim()) {
    query = query.ilike("state", params.state.trim().toUpperCase());
  }

  if (hasEmail === "yes") {
    query = query.not("email", "is", null).neq("email", "");
  }

  if (hasEmail === "no") {
    query = query.is("email", null);
  }

  if (sort === "name_asc") {
    query = query.order("full_name", { ascending: true });
  } else if (sort === "name_desc") {
    query = query.order("full_name", { ascending: false });
  } else if (sort === "city_asc") {
    query = query.order("city", { ascending: true, nullsFirst: false });
  } else if (sort === "city_desc") {
    query = query.order("city", { ascending: false, nullsFirst: false });
  } else if (sort === "state_asc") {
    query = query.order("state", { ascending: true, nullsFirst: false });
  } else if (sort === "state_desc") {
    query = query.order("state", { ascending: false, nullsFirst: false });
  } else if (sort === "cpf_asc") {
    query = query.order("cpf", { ascending: true });
  } else if (sort === "cpf_desc") {
    query = query.order("cpf", { ascending: false });
  } else if (sort === "phone_asc") {
    query = query.order("phone_mobile", { ascending: true });
  } else if (sort === "phone_desc") {
    query = query.order("phone_mobile", { ascending: false });
  } else if (sort === "created_asc") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query
    .range(offset, offset + pageSize - 1)
    .returns<ClientListItem[]>();

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Gerencie os clientes da empresa autenticada com busca, cadastro e edição."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <ClientSearch
            defaultValues={{
              q: search,
              phone: params.phone,
              status,
              city: params.city,
              state: params.state,
              hasEmail,
              sort,
              pageSize: String(pageSize),
            }}
          />
          <Link
            href="/clientes/novo"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Link>
        </div>

        {error ? (
          <StatusMessage type="error">{error.message}</StatusMessage>
        ) : (
          <>
            <ClientList
              clients={data ?? []}
              sort={sort}
              searchParams={{
                q: search,
                phone: params.phone,
                status,
                city: params.city,
                state: params.state,
                hasEmail,
                pageSize: String(pageSize),
              }}
            />
            <ClientPagination
              page={page}
              pageSize={pageSize}
              total={count ?? 0}
              searchParams={{
                q: search,
                phone: params.phone,
                status,
                city: params.city,
                state: params.state,
                hasEmail,
                sort,
                pageSize: String(pageSize),
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
