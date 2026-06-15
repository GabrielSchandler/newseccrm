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
    description: "O cliente esta aguardando uma proxima movimentacao.",
  },
  {
    value: "completed",
    label: "Concluido",
    description: "A movimentacao foi finalizada nesta etapa.",
  },
  {
    value: "cancelled",
    label: "Cancelado",
    description: "A movimentacao deixou de seguir por alguma razao.",
  },
];

export function formatClientTrackingStatus(status: ClientTrackingStatus | string | null) {
  return (
    clientTrackingStatusOptions.find((item) => item.value === status)?.label ??
    "Em andamento"
  );
}
