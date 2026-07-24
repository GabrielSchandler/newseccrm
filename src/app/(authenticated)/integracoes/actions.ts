"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { disconnectMicrosoftIntegration } from "@/lib/email/integrations";
import {
  disconnectTotalkIntegration,
  saveTotalkIntegration,
} from "@/lib/totalk/integrations";

export type IntegrationActionState = {
  ok: boolean;
  message: string;
};

function friendlyError(message: string): IntegrationActionState {
  return {
    ok: false,
    message,
  };
}

function canManageCompanyIntegration(role: string | null, isPlatformOwner: boolean) {
  return isPlatformOwner || role === "admin" || role === "manager";
}

export async function disconnectOutlookAction(): Promise<IntegrationActionState> {
  try {
    const { supabase, companyId, userProfileId } = await getCurrentUserContext();

    await disconnectMicrosoftIntegration(companyId, userProfileId);

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "email.outlook_disconnected",
      entityType: "email_integration",
      entityId: userProfileId,
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível desconectar o Outlook.",
    );
  }

  revalidatePath("/integracoes");

  return {
    ok: true,
    message: "Outlook desconectado.",
  };
}

export async function saveTotalkIntegrationAction(formData: FormData) {
  const { supabase, companyId, userProfileId, role, isPlatformOwner } =
    await getCurrentUserContext();

  if (!canManageCompanyIntegration(role, isPlatformOwner)) {
    redirect("/integracoes?error=permission");
  }

  try {
    const apiBaseUrl = String(formData.get("api_base_url") ?? "");
    const apiToken = String(formData.get("api_token") ?? "");
    const defaultSenderPhone = String(formData.get("default_sender_phone") ?? "");
    const defaultSendMessage = String(formData.get("default_send_message") ?? "");
    const integration = await saveTotalkIntegration({
      companyId,
      userProfileId,
      apiBaseUrl,
      apiToken,
      defaultSenderPhone,
      defaultSendMessage,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "totalk.integration_saved",
      entityType: "integration",
      entityId: integration.id,
      entityLabel: "Totalk",
      details: {
        api_base_url: integration.apiBaseUrl,
        default_sender_phone: integration.defaultSenderPhone,
      },
    });
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Não foi possível salvar a Totalk.",
    );
    redirect(`/integracoes?error=totalk_save_failed&details=${message}`);
  }

  revalidatePath("/integracoes");
  redirect("/integracoes?totalk=saved");
}

export async function disconnectTotalkIntegrationAction() {
  const { supabase, companyId, userProfileId, role, isPlatformOwner } =
    await getCurrentUserContext();

  if (!canManageCompanyIntegration(role, isPlatformOwner)) {
    redirect("/integracoes?error=permission");
  }

  try {
    await disconnectTotalkIntegration(companyId);

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "totalk.integration_disconnected",
      entityType: "integration",
      entityId: companyId,
      entityLabel: "Totalk",
    });
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Não foi possível desativar a Totalk.",
    );
    redirect(`/integracoes?error=totalk_disconnect_failed&details=${message}`);
  }

  revalidatePath("/integracoes");
  redirect("/integracoes?totalk=disconnected");
}
