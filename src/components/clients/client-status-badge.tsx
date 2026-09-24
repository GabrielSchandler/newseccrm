import { isDeletedClient } from "@/lib/clients/status";
import type { Client } from "@/types/client";

type ClientStatusBadgeProps = {
  client: Pick<Client, "deleted_at">;
};

export function ClientStatusBadge({ client }: ClientStatusBadgeProps) {
  const deleted = isDeletedClient(client);

  return (
    <span className={`ns-badge ${deleted ? "ns-badge-danger" : "ns-badge-success"}`}>
      {deleted ? "Excluído" : "Ativo"}
    </span>
  );
}
