import type { Client } from "@/types/client";

export function isDeletedClient(client: Pick<Client, "deleted_at">) {
  return Boolean(client.deleted_at);
}
