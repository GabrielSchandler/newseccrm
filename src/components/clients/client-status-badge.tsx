import { isDeletedClient } from "@/lib/clients/status";
import type { Client } from "@/types/client";

type ClientStatusBadgeProps = {
  client: Pick<Client, "deleted_at">;
};

export function ClientStatusBadge({ client }: ClientStatusBadgeProps) {
  const deleted = isDeletedClient(client);

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
        deleted
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-teal-200 bg-teal-50 text-teal-700"
      }`}
    >
      {deleted ? "Excluido" : "Ativo"}
    </span>
  );
}
