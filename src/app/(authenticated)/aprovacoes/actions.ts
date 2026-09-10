"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientDocument } from "@/types/client-document";
import type { ClientTrackingUpdate } from "@/types/client-tracking";

export type ClientApprovalActionState = {
  ok: boolean;
  message: string;
};

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).default(""),
});

const documentDecisionSchema = decisionSchema.extend({
  visible_to_client: z.boolean(),
  downloadable_by_client: z.boolean(),
});

function result(ok: boolean, message: string): ClientApprovalActionState {
  return { ok, message };
}

async function assertManagementAccess() {
  const context = await getCurrentUserContext();
  const allowed =
    context.isPlatformOwner || context.role === "admin" || context.role === "manager";

  if (!allowed) {
    throw new Error("Somente usuários com acesso à Gestão podem revisar publicações.");
  }

  return context;
}

function validateRejectionNote(decision: "approved" | "rejected", note: string) {
  if (decision === "rejected" && note.length < 3) {
    return "Explique o ajuste necessário antes de devolver a solicitação.";
  }

  return null;
}

export async function reviewTrackingUpdateAction(
  updateId: string,
  values: z.input<typeof decisionSchema>,
): Promise<ClientApprovalActionState> {
  const parsed = decisionSchema.safeParse(values);

  if (!parsed.success) {
    return result(false, "Confira a decisão e a observação.");
  }

  const noteError = validateRejectionNote(parsed.data.decision, parsed.data.note);

  if (noteError) {
    return result(false, noteError);
  }

  try {
    const context = await assertManagementAccess();
    const adminSupabase = createAdminClient();
    const { data, error: loadError } = await adminSupabase
      .from("client_tracking_updates")
      .select("*")
      .eq("id", updateId)
      .eq("company_id", context.companyId)
      .eq("approval_status", "pending")
      .is("deleted_at", null)
      .maybeSingle();
    const update = data as ClientTrackingUpdate | null;

    if (loadError) throw loadError;
    if (!update) return result(false, "Esta solicitação já foi revisada ou não existe.");
    if (!update.visible_to_client) {
      return result(false, "Esta atualização está marcada apenas para uso interno.");
    }

    const reviewedAt = new Date().toISOString();
    const { data: reviewedUpdate, error } = await adminSupabase
      .from("client_tracking_updates")
      .update({
        approval_status: parsed.data.decision,
        approval_reviewed_by: context.userProfileId,
        approval_reviewed_at: reviewedAt,
        approval_review_note: parsed.data.note || null,
        updated_by: context.userProfileId,
        updated_at: reviewedAt,
      })
      .eq("id", update.id)
      .eq("company_id", context.companyId)
      .eq("approval_status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!reviewedUpdate) {
      return result(false, "Esta solicitação já foi revisada por outra pessoa.");
    }

    await recordAuditLog({
      supabase: context.supabase,
      companyId: context.companyId,
      userProfileId: context.userProfileId,
      action:
        parsed.data.decision === "approved"
          ? "client_tracking.approved_for_portal"
          : "client_tracking.rejected_for_portal",
      entityType: "client_tracking_update",
      entityId: update.id,
      entityLabel: update.title,
      details: {
        client_id: update.client_id,
        pre_sale_id: update.pre_sale_id,
        review_note: parsed.data.note || null,
      },
    });

    await recordClientTimelineEvent({
      companyId: context.companyId,
      clientId: update.client_id,
      preSaleId: update.pre_sale_id,
      eventType: "tracking_update_updated",
      title:
        parsed.data.decision === "approved"
          ? "Atualização aprovada para o portal"
          : "Atualização devolvida para ajuste",
      note: parsed.data.note || null,
      actorUserProfileId: context.userProfileId,
      actorRole: context.role,
      actorBusinessArea: context.businessArea,
      actor: context.profile,
      details: {
        tracking_update_id: update.id,
        approval_status: parsed.data.decision,
      },
    });

    revalidatePath("/aprovacoes");
    revalidatePath(`/clientes/${update.client_id}`);
    revalidatePath("/acompanhamento");

    return result(
      true,
      parsed.data.decision === "approved"
        ? "Atualização publicada para o cliente."
        : "Atualização devolvida para ajuste.",
    );
  } catch (error) {
    return result(
      false,
      error instanceof Error ? error.message : "Não foi possível revisar a atualização.",
    );
  }
}

export async function reviewClientDocumentAction(
  documentId: string,
  values: z.input<typeof documentDecisionSchema>,
): Promise<ClientApprovalActionState> {
  const parsed = documentDecisionSchema.safeParse(values);

  if (!parsed.success) {
    return result(false, "Confira a decisão e as permissões do documento.");
  }

  const noteError = validateRejectionNote(parsed.data.decision, parsed.data.note);

  if (noteError) {
    return result(false, noteError);
  }

  if (parsed.data.decision === "approved" && !parsed.data.visible_to_client) {
    return result(false, "Para aprovar, permita que o cliente saiba que o arquivo existe.");
  }

  try {
    const context = await assertManagementAccess();
    const adminSupabase = createAdminClient();
    const { data, error: loadError } = await adminSupabase
      .from("client_documents")
      .select("*")
      .eq("id", documentId)
      .eq("company_id", context.companyId)
      .eq("client_access_status", "pending")
      .eq("document_type", "extrajudicial")
      .is("deleted_at", null)
      .maybeSingle();
    const document = data as ClientDocument | null;

    if (loadError) throw loadError;
    if (!document) return result(false, "Esta solicitação já foi revisada ou não existe.");
    if (!document.pre_sale_id) {
      return result(false, "Vincule o documento a uma pré-venda antes de aprovar.");
    }

    const reviewedAt = new Date().toISOString();
    const approved = parsed.data.decision === "approved";
    const visibleToClient = approved
      ? parsed.data.visible_to_client
      : document.client_visibility_requested;
    const downloadableByClient = approved
      ? parsed.data.visible_to_client && parsed.data.downloadable_by_client
      : document.client_download_requested;
    const { data: reviewedDocument, error } = await adminSupabase
      .from("client_documents")
      .update({
        client_visibility_requested: visibleToClient,
        client_download_requested: downloadableByClient,
        client_access_status: parsed.data.decision,
        client_access_reviewed_by: context.userProfileId,
        client_access_reviewed_at: reviewedAt,
        client_access_review_note: parsed.data.note || null,
        updated_at: reviewedAt,
      })
      .eq("id", document.id)
      .eq("company_id", context.companyId)
      .eq("client_access_status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!reviewedDocument) {
      return result(false, "Esta solicitação já foi revisada por outra pessoa.");
    }

    await recordAuditLog({
      supabase: context.supabase,
      companyId: context.companyId,
      userProfileId: context.userProfileId,
      action: approved
        ? "client_document.approved_for_portal"
        : "client_document.rejected_for_portal",
      entityType: "client_document",
      entityId: document.id,
      entityLabel: document.title || document.file_name,
      details: {
        client_id: document.client_id,
        pre_sale_id: document.pre_sale_id,
        visible_to_client: visibleToClient,
        downloadable_by_client: downloadableByClient,
        review_note: parsed.data.note || null,
      },
    });

    await recordClientTimelineEvent({
      companyId: context.companyId,
      clientId: document.client_id,
      preSaleId: document.pre_sale_id,
      eventType: "client_document_updated",
      title: approved
        ? "Documento extrajudicial aprovado para o portal"
        : "Documento extrajudicial devolvido para ajuste",
      note: parsed.data.note || null,
      actorUserProfileId: context.userProfileId,
      actorRole: context.role,
      actorBusinessArea: context.businessArea,
      actor: context.profile,
      details: {
        client_document_id: document.id,
        client_access_status: parsed.data.decision,
        downloadable_by_client: downloadableByClient,
      },
    });

    revalidatePath("/aprovacoes");
    revalidatePath(`/clientes/${document.client_id}`);
    revalidatePath(`/pre-vendas/${document.pre_sale_id}`);
    revalidatePath("/acompanhamento");

    return result(
      true,
      approved
        ? "Acesso do cliente ao documento aprovado."
        : "Documento devolvido para ajuste.",
    );
  } catch (error) {
    return result(
      false,
      error instanceof Error ? error.message : "Não foi possível revisar o documento.",
    );
  }
}
