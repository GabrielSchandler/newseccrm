import type { ClientApprovalStatus } from "@/types/client-approval";
import type { ClientDocumentType } from "@/types/client-document";

export function getTrackingApprovalStatus(
  requestedForClient: boolean,
): ClientApprovalStatus {
  return requestedForClient ? "pending" : "not_requested";
}

export function normalizeDocumentClientAccessRequest({
  documentType,
  visibleToClient,
  downloadableByClient,
}: {
  documentType: ClientDocumentType;
  visibleToClient: boolean;
  downloadableByClient: boolean;
}) {
  const canPublish = documentType === "extrajudicial" && visibleToClient;

  return {
    visibleToClient: canPublish,
    downloadableByClient: canPublish && downloadableByClient,
    status: canPublish ? ("pending" as const) : ("not_requested" as const),
  };
}

export function isTrackingUpdatePublished({
  visibleToClient,
  approvalStatus,
}: {
  visibleToClient: boolean;
  approvalStatus: ClientApprovalStatus | string | null | undefined;
}) {
  return visibleToClient && approvalStatus === "approved";
}

export function getApprovedDocumentClientAccess({
  documentType,
  visibleToClient,
  downloadableByClient,
  approvalStatus,
}: {
  documentType: ClientDocumentType;
  visibleToClient: boolean;
  downloadableByClient: boolean;
  approvalStatus: ClientApprovalStatus | string | null | undefined;
}) {
  const canList =
    documentType === "extrajudicial" &&
    visibleToClient &&
    approvalStatus === "approved";

  return {
    canList,
    canDownload: canList && downloadableByClient,
  };
}
