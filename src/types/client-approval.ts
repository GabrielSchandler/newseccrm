export type ClientApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

export const clientApprovalStatusLabels: Record<ClientApprovalStatus, string> = {
  not_requested: "Uso interno",
  pending: "Aguardando aprovação",
  approved: "Aprovado para o cliente",
  rejected: "Ajuste solicitado",
};

export function formatClientApprovalStatus(
  status: ClientApprovalStatus | string | null | undefined,
) {
  return clientApprovalStatusLabels[status as ClientApprovalStatus] ?? "Uso interno";
}
