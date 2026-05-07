import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompanyUserRole } from "@/types/user";
import { normalizeBusinessArea, type CompanyBusinessArea } from "@/lib/workspace";

export class UserProfileContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserProfileContextError";
  }
}

export type CurrentUserProfile = {
  id: string;
  auth_user_id: string;
  company_id: string;
  role: CompanyUserRole | null;
  business_area: CompanyBusinessArea | null;
  nickname: string | null;
  username: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
};

export async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, auth_user_id, company_id, role, business_area, nickname, username, email, full_name, phone, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = data as CurrentUserProfile | null;

  if (profileError) {
    throw new UserProfileContextError(
      "Nao foi possivel carregar o perfil do usuario autenticado.",
    );
  }

  if (!profile) {
    throw new UserProfileContextError(
      "Existe uma sessao autenticada, mas nao ha perfil vinculado em public.user_profiles.",
    );
  }

  if (!profile.company_id) {
    throw new UserProfileContextError(
      "O perfil do usuario autenticado nao possui company_id em public.user_profiles.",
    );
  }

  if (!profile.is_active) {
    redirect("/conta-inativa");
  }

  return {
    supabase,
    user,
    authUserId: user.id,
    userProfileId: profile.id,
    companyId: profile.company_id,
    role: profile.role,
    businessArea: normalizeBusinessArea(profile.business_area),
    nickname: profile.nickname,
    username: profile.username,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    isActive: profile.is_active,
    profile,
  };
}
