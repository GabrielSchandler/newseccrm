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
      className={`inline-flex items-center gap-1 font-semibold transition hover:text-[var(--ns-primary)] ${
        active ? "text-[var(--ns-primary)]" : ""
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
      <div className="ns-card p-8 text-center">
        <h3 className="text-lg font-semibold text-[var(--ns-text)]">
          Nenhum cliente encontrado
        </h3>
        <p className="mt-2 text-sm text-[var(--ns-text-secondary)]">
          Cadastre um novo cliente ou ajuste os termos da busca.
        </p>
      </div>
    );
  }

  return (
    <div className="ns-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-[var(--ns-bg)] text-xs uppercase tracking-wide text-[var(--ns-text-secondary)]">
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
          <tbody className="divide-y divide-[var(--ns-border)]">
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => router.push(`/clientes/${client.id}`)}
                className={`cursor-pointer transition hover:bg-[var(--ns-surface-hover)] ${
                  client.deleted_at ? "bg-[var(--ns-bg)] opacity-70" : ""
                }`}
              >
                <td className="px-5 py-4 font-medium text-[var(--ns-text)]">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="hover:text-[var(--ns-primary)]"
                    >
                      {client.full_name}
                    </Link>
                    <ClientStatusBadge client={client} />
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--ns-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span>{displayCpf(client.cpf)}</span>
                    <CopyButton value={displayCpf(client.cpf)} label="Copiar" />
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--ns-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span>{displayPhone(client.phone_mobile)}</span>
                    <CopyButton value={displayPhone(client.phone_mobile)} label="Copiar" />
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--ns-text-secondary)]">
                  {displayValue(client.city)}
                </td>
                <td className="px-5 py-4 text-[var(--ns-text-secondary)]">
                  {displayValue(client.state)}
                </td>
                <td className="px-5 py-4 text-[var(--ns-text-secondary)]">
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-primary)]/30 bg-[var(--ns-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ns-primary)] transition hover:bg-[var(--ns-primary)]/10"
                    />
                    <Link
                      href={`/clientes/${client.id}`}
                      className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                    >
                      Ver
                    </Link>
                    {client.deleted_at ? null : (
                      <Link
                        href={`/clientes/${client.id}/editar`}
                        className="rounded-lg bg-[var(--ns-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--ns-primary-foreground)] transition hover:opacity-90"
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
