"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername } from "@/lib/users/account";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_COMPANY_COOKIE_NAME,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/workspace";

export type LoginActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

async function getUserLoginState(authUserId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("password_must_change, is_platform_owner")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error?.code === "42703") {
    const { data: fallbackData } = await adminClient
      .from("user_profiles")
      .select("password_must_change")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    return {
      mustChangePassword: Boolean(
        (fallbackData as { password_must_change?: boolean | null } | null)
          ?.password_must_change,
      ),
      isPlatformOwner: false,
    };
  }

  if (error) {
    return {
      mustChangePassword: false,
      isPlatformOwner: false,
    };
  }

  const profile = data as {
    password_must_change?: boolean | null;
    is_platform_owner?: boolean | null;
  } | null;

  return {
    mustChangePassword: Boolean(profile?.password_must_change),
    isPlatformOwner: Boolean(profile?.is_platform_owner),
  };
}

export async function signInWithLoginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  try {
    const login = String(formData.get("login") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const redirectedFrom = String(formData.get("redirectedFrom") ?? "/");

    if (!login || !password) {
      return {
        ok: false,
        message: "Informe o login e a senha.",
      };
    }

    let authEmail = login.toLowerCase();

    if (!login.includes("@")) {
      const adminClient = createAdminClient();
      const normalizedUsername = normalizeUsername(login);
      const { data, error } = await adminClient
        .from("user_profiles")
        .select("email, is_active")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (error || !data?.email) {
        return {
          ok: false,
          message: "Nao foi possivel entrar. Confira login e senha.",
        };
      }

      if (data.is_active === false) {
        return {
          ok: false,
          message: "Nao foi possivel entrar. Confira login e senha.",
        };
      }

      authEmail = data.email;
    }

    const supabase = await createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      return {
        ok: false,
        message: "Nao foi possivel entrar. Confira login e senha.",
      };
    }

    const loginState = signInData.user
      ? await getUserLoginState(signInData.user.id)
      : { mustChangePassword: false, isPlatformOwner: false };

    const redirectTo = loginState.mustChangePassword
      ? "/alterar-senha"
      : loginState.isPlatformOwner
        ? "/empresas"
        : redirectedFrom.startsWith("/") && !redirectedFrom.startsWith("//")
          ? redirectedFrom
          : "/";

    return {
      ok: true,
      message: "Acesso liberado.",
      redirectTo,
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel entrar agora. Tente novamente.",
    };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE_NAME);
  cookieStore.delete(WORKSPACE_COOKIE_NAME);
  redirect("/login");
}
