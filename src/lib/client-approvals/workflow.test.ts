import { describe, expect, it } from "vitest";
import {
  getApprovedDocumentClientAccess,
  getTrackingApprovalStatus,
  isTrackingUpdatePublished,
  normalizeDocumentClientAccessRequest,
} from "./workflow";

describe("client portal approval workflow", () => {
  it("sends client-facing tracking updates to approval", () => {
    expect(getTrackingApprovalStatus(true)).toBe("pending");
    expect(getTrackingApprovalStatus(false)).toBe("not_requested");
  });

  it("publishes tracking updates only after approval", () => {
    expect(
      isTrackingUpdatePublished({
        visibleToClient: true,
        approvalStatus: "pending",
      }),
    ).toBe(false);
    expect(
      isTrackingUpdatePublished({
        visibleToClient: true,
        approvalStatus: "approved",
      }),
    ).toBe(true);
  });

  it("allows client access requests only for extrajudicial documents", () => {
    expect(
      normalizeDocumentClientAccessRequest({
        documentType: "documentacao",
        visibleToClient: true,
        downloadableByClient: true,
      }),
    ).toEqual({
      visibleToClient: false,
      downloadableByClient: false,
      status: "not_requested",
    });
  });

  it("requires visibility before requesting a download", () => {
    expect(
      normalizeDocumentClientAccessRequest({
        documentType: "extrajudicial",
        visibleToClient: false,
        downloadableByClient: true,
      }),
    ).toEqual({
      visibleToClient: false,
      downloadableByClient: false,
      status: "not_requested",
    });
  });

  it("separates document listing from download permission", () => {
    expect(
      getApprovedDocumentClientAccess({
        documentType: "extrajudicial",
        visibleToClient: true,
        downloadableByClient: false,
        approvalStatus: "approved",
      }),
    ).toEqual({ canList: true, canDownload: false });
    expect(
      getApprovedDocumentClientAccess({
        documentType: "extrajudicial",
        visibleToClient: true,
        downloadableByClient: true,
        approvalStatus: "approved",
      }),
    ).toEqual({ canList: true, canDownload: true });
  });
});
