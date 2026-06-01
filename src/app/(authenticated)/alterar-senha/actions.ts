"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/audit/log";

export type PasswordChangeActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

function friendlyError(message: string): PasswordChangeActionState {
  return {
    ok: false,
    message,
  };
}

export async function changeRequiredPasswordAction(
  _previousState: PasswordChangeActionState,
  formData: FormData,
): Promise<PasswordChangeActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) {
    return friendlyError("A nova senha deve ter pelo menos 6 caracteres.");
  }

  if (password !== confirmPassword) {
    return friendlyError("As senhas informadas nao conferem.");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return friendlyError("Sessao expirada. Entre novamente para alterar a senha.");
    }

    const { error: authError } = await supabase.auth.updateUser({
      password,
    });

    if (authError) {
      return friendlyError(authError.message);
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return friendlyError(
        profileError?.message || "Perfil do usuario nao encontrado.",
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update({
        password_must_change: false,
        password_changed_at: now,
        updated_at: now,
      })
      .eq("id", profile.id);

    if (updateError) {
      return friendlyError(updateError.message);
    }

    await recordAuditLog({
      supabase: adminClient,
      companyId: profile.company_id,
      userProfileId: profile.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: profile.id,
      entityLabel: user.email ?? profile.id,
      details: {
        self_service: true,
      },
    });

    return {
      ok: true,
      message: "Senha alterada com sucesso.",
      redirectTo: "/",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel alterar a senha.",
    );
  }
}
