"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { CopyButton } from "@/components/clients/copy-button";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import {
  displayCpf,
  displayPhone,
  displayValue,
  formatDate,
} from "@/lib/clients/formatters";
import type { ClientListItem } from "@/types/client";

type ClientListProps = {
  clients: ClientListItem[];
  sort: string;
  searchParams: Record<string, string | undefined>;
};

const sortableColumns = {
  full_name: {
    label: "Nome",
    asc: "name_asc",
    desc: "name_desc",
  },
  cpf: {
    label: "CPF",
    asc: "cpf_asc",
    desc: "cpf_desc",
  },
  phone_mobile: {
    label: "Celular",
    asc: "phone_asc",
    desc: "phone_desc",
  },
  city: {
    label: "Cidade",
    asc: "city_asc",
    desc: "city_desc",
  },
  state: {
    label: "Estado",
    asc: "state_asc",
    desc: "state_desc",
  },
  created_at: {
    label: "Criado em",
    asc: "created_asc",
    desc: "created_desc",
  },
} as const;

function buildSortHref(
  searchParams: Record<string, string | undefined>,
  sort: string,
  column: keyof typeof sortableColumns,
) {
  const params = new URLSearchParams();
  const config = sortableColumns[column];
  const nextSort = sort === config.asc ? config.desc : config.asc;

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value && key !== "success") {
      params.set(key, value);
    }
  });

  params.set("sort", nextSort);
  params.set("page", "1");
  return `/clientes?${params.toString()}`;
}

function SortHeader({
  column,
  sort,
  searchParams,
}: {
  column: keyof typeof sortableColumns;
  sort: string;
  searchParams: Record<string, string | undefined>;
}) {
  const config = sortableColumns[column];
  const active = sort === config.asc || sort === config.desc;
  const direction = sort === config.asc ? "ASC" : sort === config.desc ? "DESC" : "";

  return (
    <Link
      href={buildSortHref(searchParams, sort, column)}
      className={`inline-flex items-center gap-1 font-semibold transition hover:text-teal-700 ${
        active ? "text-teal-700" : ""
      }`}
    >
      {config.label}
      {direction ? <span>{direction}</span> : null}
    </Link>
  );
}

export function ClientList({ clients, sort, searchParams }: ClientListProps) {
  const router = useRouter();

  if (!clients.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">
          Nenhum cliente encontrado
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Cadastre um novo cliente ou ajuste os termos da busca.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">
                <SortHeader column="full_name" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3">
                <SortHeader column="cpf" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3">
                <SortHeader column="phone_mobile" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3">
                <SortHeader column="city" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3">
                <SortHeader column="state" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3">
                <SortHeader column="created_at" sort={sort} searchParams={searchParams} />
              </th>
              <th className="px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => router.push(`/clientes/${client.id}`)}
                className={`cursor-pointer transition hover:bg-slate-50 ${
                  client.deleted_at ? "bg-slate-50 opacity-70" : ""
                }`}
              >
                <td className="px-5 py-4 font-medium text-slate-950">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="hover:text-teal-700"
                    >
                      {client.full_name}
                    </Link>
                    <ClientStatusBadge client={client} />
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span>{displayCpf(client.cpf)}</span>
                    <CopyButton value={displayCpf(client.cpf)} label="Copiar" />
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span>{displayPhone(client.phone_mobile)}</span>
                    <CopyButton value={displayPhone(client.phone_mobile)} label="Copiar" />
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {displayValue(client.city)}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {displayValue(client.state)}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {formatDate(client.created_at)}
                </td>
                <td className="px-5 py-4">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <WhatsAppLink
                      phone={client.phone_mobile}
                      label="WhatsApp"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                    />
                    <Link
                      href={`/clientes/${client.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Ver
                    </Link>
                    {client.deleted_at ? null : (
                      <Link
                        href={`/clientes/${client.id}/editar`}
                        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
                      >
                        Editar
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
