"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername } from "@/lib/users/account";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

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
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      return {
        ok: false,
        message: "Nao foi possivel entrar. Confira login e senha.",
      };
    }

    return {
      ok: true,
      message: "Acesso liberado.",
      redirectTo:
        redirectedFrom.startsWith("/") && !redirectedFrom.startsWith("//")
          ? redirectedFrom
          : "/",
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
  redirect("/login");
}
