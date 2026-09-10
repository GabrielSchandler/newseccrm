import type { ClientApprovalStatus } from "@/types/client-approval";

export type ClientTrackingStatus = "in_progress" | "completed" | "cancelled";

export type ClientTrackingUpdate = {
  id: string;
  company_id: string;
  client_id: string;
  pre_sale_id: string;
  title: string;
  description: string;
  status: ClientTrackingStatus;
  visible_to_client: boolean;
  approval_status: ClientApprovalStatus;
  approval_requested_by: string | null;
  approval_requested_at: string | null;
  approval_reviewed_by: string | null;
  approval_reviewed_at: string | null;
  approval_review_note: string | null;
  event_at: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

export const clientTrackingStatusOptions: Array<{
  value: ClientTrackingStatus;
  label: string;
  description: string;
}> = [
  {
    value: "in_progress",
    label: "Em andamento",
    description: "O cliente está aguardando uma próxima movimentação.",
  },
  {
    value: "completed",
    label: "Concluído",
    description: "A movimentação foi finalizada nesta etapa.",
  },
  {
    value: "cancelled",
    label: "Cancelado",
    description: "A movimentação deixou de seguir por alguma razão.",
  },
];

export function formatClientTrackingStatus(status: ClientTrackingStatus | string | null) {
  return (
    clientTrackingStatusOptions.find((item) => item.value === status)?.label ??
    "Em andamento"
  );
}
