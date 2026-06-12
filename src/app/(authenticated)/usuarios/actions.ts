"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  buildInternalAuthEmail,
  normalizeUsername,
  resolveUserDisplayName,
} from "@/lib/users/account";
import {
  createCompanyUserSchema,
  updateCompanyUserSchema,
  type CreateCompanyUserPayload,
  type UpdateCompanyUserPayload,
} from "@/lib/users/schema";
import type { CompanyUserProfile, CompanyUserRole } from "@/types/user";

export type UserManagementActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

type LicenseSummary = {
  limit: number;
  activeUsers: number;
  availableLicenses: number;
};

function friendlyError(message: string): UserManagementActionState {
  return {
    ok: false,
    message,
  };
}

function canAccessUserManagement(role: string | null) {
  return role === "admin" || role === "manager";
}

function canCreateUsers(role: string | null) {
  return role === "admin";
}

function canManageTargetUser(
  actorRole: string | null,
  targetUser: CompanyUserProfile,
) {
  if (actorRole === "admin") {
    return true;
  }

  if (actorRole === "manager") {
    return targetUser.role === "seller";
  }

  return false;
}

function canAssignRole(
  actorRole: string | null,
  targetRole: CompanyUserRole,
) {
  if (actorRole === "admin") {
    return true;
  }

  if (actorRole === "manager") {
    return targetRole === "seller";
  }

  return false;
}

function getLegalRoleForPersistence(businessArea: string, legalRole: string | null | undefined) {
  return businessArea === "legal" ? legalRole ?? "consultant" : null;
}

async function getLicenseSummary(companyId: string): Promise<LicenseSummary> {
  const { supabase } = await getCurrentUserContext();
  const [{ data: companyData, error: companyError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("user_license_limit")
        .eq("id", companyId)
        .single(),
      supabase
        .from("user_profiles")
        .select("id", { head: true, count: "exact" })
        .eq("company_id", companyId)
        .eq("is_active", true),
    ]);

  if (companyError) {
    throw new Error(companyError.message);
  }

  if (countError) {
    throw new Error(countError.message);
  }

  const limit = Math.max(0, Number(companyData?.user_license_limit ?? 0));
  const activeUsers = count ?? 0;

  return {
    limit,
    activeUsers,
    availableLicenses: Math.max(limit - activeUsers, 0),
  };
}

async function getCompanyUser(userId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CompanyUserProfile;
}

async function ensureNotLastActiveAdmin(
  companyId: string,
  targetUser: CompanyUserProfile,
  nextRole: CompanyUserRole,
  nextIsActive: boolean,
) {
  const isCurrentlyProtectedAdmin =
    targetUser.role === "admin" && targetUser.is_active;
  const keepsAdminActive = nextRole === "admin" && nextIsActive;

  if (!isCurrentlyProtectedAdmin || keepsAdminActive) {
    return;
  }

  const { supabase } = await getCurrentUserContext();
  const { count, error } = await supabase
    .from("user_profiles")
    .select("id", { head: true, count: "exact" })
    .eq("company_id", companyId)
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) <= 1) {
    throw new Error("Nao e permitido desativar ou rebaixar o ultimo admin ativo da empresa.");
  }
}

async function revalidateUserPages(userId?: string) {
  revalidatePath("/usuarios");

  if (userId) {
    revalidatePath(`/usuarios/${userId}/editar`);
  }
}

export async function createCompanyUserAction(
  values: CreateCompanyUserPayload,
): Promise<UserManagementActionState> {
  const parsed = createCompanyUserSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do usuario.");
  }

  let createdAuthUserId: string | null = null;
  let internalAuthEmail: string | null = null;

  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canCreateUsers(role)) {
      return friendlyError("Apenas administradores podem criar usuarios.");
    }

    if (!canAssignRole(role, parsed.data.role)) {
      return friendlyError("Voce nao pode criar usuario com esse cargo.");
    }

    const licenseSummary = await getLicenseSummary(companyId);

    if (licenseSummary.activeUsers >= licenseSummary.limit) {
      return friendlyError(
        "Limite de usuarios atingido. Contrate uma licenca adicional.",
      );
    }

    const adminClient = createAdminClient();
    const normalizedUsername = normalizeUsername(parsed.data.username);
    internalAuthEmail = buildInternalAuthEmail(normalizedUsername);

    const { data: duplicatedUser, error: duplicatedUserError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (duplicatedUserError) {
      return friendlyError(duplicatedUserError.message);
    }

    if (duplicatedUser) {
      return friendlyError("Ja existe usuario cadastrado com este login.");
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: internalAuthEmail,
      password: parsed.data.temporary_password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        nickname: parsed.data.nickname,
        username: normalizedUsername,
      },
    });

    if (authError || !authData.user) {
      return friendlyError(authError?.message || "Nao foi possivel criar o usuario no Auth.");
    }

    createdAuthUserId = authData.user.id;

    const { error: profileError } = await supabase.from("user_profiles").insert({
      auth_user_id: createdAuthUserId,
      company_id: companyId,
      full_name: parsed.data.full_name,
      nickname: parsed.data.nickname,
      username: normalizedUsername,
      email: internalAuthEmail,
      phone: parsed.data.phone,
      monthly_goal: parsed.data.monthly_goal,
      role: parsed.data.role,
      business_area: parsed.data.business_area,
      legal_role: getLegalRoleForPersistence(
        parsed.data.business_area,
        parsed.data.legal_role,
      ),
      is_active: true,
      password_must_change: true,
      password_reset_at: new Date().toISOString(),
      password_reset_by: userProfileId,
      password_changed_at: null,
      last_set_password: parsed.data.temporary_password,
      invited_by: userProfileId,
      deactivated_at: null,
      deactivated_by: null,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdAuthUserId);
      return friendlyError(
        `Usuario criado no Auth, mas falhou ao criar perfil da empresa: ${profileError.message}`,
      );
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "user.created",
      entityType: "user",
      entityId: createdAuthUserId,
      entityLabel: parsed.data.full_name,
      details: {
        username: normalizedUsername,
        nickname: parsed.data.nickname,
        role: parsed.data.role,
        business_area: parsed.data.business_area,
        monthly_goal: parsed.data.monthly_goal,
        legal_role: getLegalRoleForPersistence(
          parsed.data.business_area,
          parsed.data.legal_role,
        ),
      },
    });
  } catch (error) {
    if (createdAuthUserId) {
      try {
        const adminClient = createAdminClient();
        await adminClient.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        // Best effort cleanup; the profile creation failure is the primary error.
      }
    }

    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar o usuario.",
    );
  }

  await revalidateUserPages();

  return {
    ok: true,
    message: "Usuario criado com sucesso.",
    redirectTo: "/usuarios?success=created",
  };
}

export async function updateCompanyUserAction(
  userId: string,
  values: UpdateCompanyUserPayload,
): Promise<UserManagementActionState> {
  const parsed = updateCompanyUserSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do usuario.");
  }

  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canAccessUserManagement(role)) {
      return friendlyError("Voce nao tem permissao para editar usuarios.");
    }

    const targetUser = await getCompanyUser(userId, companyId);

    if (!canManageTargetUser(role, targetUser)) {
      return friendlyError("Voce nao pode editar este usuario.");
    }

    if (!canAssignRole(role, parsed.data.role)) {
      return friendlyError("Voce nao pode definir este cargo para o usuario.");
    }

    const adminClient = createAdminClient();
    const normalizedUsername = normalizeUsername(parsed.data.username);
    const nextInternalAuthEmail = buildInternalAuthEmail(normalizedUsername);

    const { data: duplicateUsername, error: duplicateUsernameError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .neq("id", userId)
      .maybeSingle();

    if (duplicateUsernameError) {
      return friendlyError(duplicateUsernameError.message);
    }

    if (duplicateUsername) {
      return friendlyError("Ja existe outro usuario com este login.");
    }

    await ensureNotLastActiveAdmin(
      companyId,
      targetUser,
      parsed.data.role,
      parsed.data.is_active,
    );

    if (targetUser.is_active && !parsed.data.is_active) {
      const licenseSummary = await getLicenseSummary(companyId);

      if (licenseSummary.activeUsers <= 0) {
        return friendlyError("Nao foi possivel desativar este usuario agora.");
      }
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      targetUser.auth_user_id,
      {
        email: nextInternalAuthEmail,
        user_metadata: {
          full_name: parsed.data.full_name,
          nickname: parsed.data.nickname,
          username: normalizedUsername,
        },
      },
    );

    if (authUpdateError) {
      return friendlyError(authUpdateError.message);
    }

    if (parsed.data.new_password) {
      if (role !== "admin") {
        return friendlyError("Apenas administradores podem redefinir senhas.");
      }

      const { error: passwordUpdateError } =
        await adminClient.auth.admin.updateUserById(targetUser.auth_user_id, {
          password: parsed.data.new_password,
        });

      if (passwordUpdateError) {
        return friendlyError(passwordUpdateError.message);
      }
    }

    const passwordUpdatedAt = parsed.data.new_password
      ? new Date().toISOString()
      : null;
    const nextValues = {
      full_name: parsed.data.full_name,
      nickname: parsed.data.nickname,
      username: normalizedUsername,
      email: nextInternalAuthEmail,
      phone: parsed.data.phone,
      monthly_goal: parsed.data.monthly_goal,
      role: parsed.data.role,
      business_area: parsed.data.business_area,
      legal_role: getLegalRoleForPersistence(
        parsed.data.business_area,
        parsed.data.legal_role,
      ),
      is_active: parsed.data.is_active,
      ...(parsed.data.new_password
        ? {
            password_must_change: parsed.data.force_password_change,
            password_reset_at: passwordUpdatedAt,
            password_reset_by: userProfileId,
            password_changed_at: parsed.data.force_password_change
              ? null
              : passwordUpdatedAt,
            last_set_password: parsed.data.new_password,
          }
        : {}),
      deactivated_at: parsed.data.is_active ? null : new Date().toISOString(),
      deactivated_by: parsed.data.is_active ? null : userProfileId,
      updated_at: new Date().toISOString(),
    };

    if (!targetUser.is_active && parsed.data.is_active) {
      const licenseSummary = await getLicenseSummary(companyId);

      if (licenseSummary.availableLicenses <= 0) {
        return friendlyError(
          "Nao ha licencas disponiveis para reativar este usuario.",
        );
      }
    }

    const { error } = await supabase
      .from("user_profiles")
      .update(nextValues)
      .eq("id", userId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "user.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: parsed.data.full_name,
      details: {
        username: normalizedUsername,
        nickname: parsed.data.nickname,
        role: parsed.data.role,
        business_area: parsed.data.business_area,
        monthly_goal: parsed.data.monthly_goal,
        legal_role: getLegalRoleForPersistence(
          parsed.data.business_area,
          parsed.data.legal_role,
        ),
        is_active: parsed.data.is_active,
        password_reset: Boolean(parsed.data.new_password),
        force_password_change: parsed.data.new_password
          ? parsed.data.force_password_change
          : undefined,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario.",
    );
  }

  await revalidateUserPages(userId);

  return {
    ok: true,
    message: "Usuario atualizado.",
    redirectTo: `/usuarios?success=updated`,
  };
}

export async function toggleCompanyUserStatusAction(
  userId: string,
): Promise<UserManagementActionState> {
  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canAccessUserManagement(role)) {
      return friendlyError("Voce nao tem permissao para alterar usuarios.");
    }

    const targetUser = await getCompanyUser(userId, companyId);

    if (!canManageTargetUser(role, targetUser)) {
      return friendlyError("Voce nao pode alterar este usuario.");
    }

    if (targetUser.is_active) {
      await ensureNotLastActiveAdmin(companyId, targetUser, targetUser.role ?? "seller", false);

      const { error } = await supabase
        .from("user_profiles")
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: userProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("company_id", companyId);

      if (error) {
        return friendlyError(error.message);
      }

      await recordAuditLog({
        supabase,
        companyId,
        userProfileId,
        action: "user.deactivated",
        entityType: "user",
        entityId: userId,
        entityLabel: resolveUserDisplayName(targetUser, userId),
        details: {
          role: targetUser.role,
        },
      });

      await revalidateUserPages(userId);
      return {
        ok: true,
        message: "Usuario desativado.",
      };
    }

    const licenseSummary = await getLicenseSummary(companyId);

    if (licenseSummary.availableLicenses <= 0) {
      return friendlyError("Nao ha licencas disponiveis para reativar este usuario.");
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "user.activated",
      entityType: "user",
      entityId: userId,
      entityLabel: resolveUserDisplayName(targetUser, userId),
      details: {
        role: targetUser.role,
      },
    });

    await revalidateUserPages(userId);

    return {
      ok: true,
      message: "Usuario reativado.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel alterar o usuario.",
    );
  }
}
