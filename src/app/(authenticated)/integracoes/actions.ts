"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { disconnectMicrosoftIntegration } from "@/lib/email/integrations";

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
      error instanceof Error ? error.message : "Nao foi possivel desconectar o Outlook.",
    );
  }

  revalidatePath("/integracoes");

  return {
    ok: true,
    message: "Outlook desconectado.",
  };
}
