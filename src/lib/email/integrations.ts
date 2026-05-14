import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptEmailSecret, encryptEmailSecret } from "@/lib/email/crypto";
import {
  getMicrosoftProfile,
  refreshMicrosoftAccessToken,
} from "@/lib/email/microsoft";
import type { EmailIntegration } from "@/types/email";

type PersistMicrosoftIntegrationInput = {
  companyId: string;
  userProfileId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

function tokenExpiresAt(expiresIn: number) {
  const safetyWindowSeconds = 60;
  return new Date(
    Date.now() + Math.max(0, expiresIn - safetyWindowSeconds) * 1000,
  ).toISOString();
}

export async function persistMicrosoftIntegration({
  companyId,
  userProfileId,
  accessToken,
  refreshToken,
  expiresIn,
  scope,
}: PersistMicrosoftIntegrationInput) {
  const profile = await getMicrosoftProfile(accessToken);
  const email = profile.mail || profile.userPrincipalName;

  if (!email) {
    throw new Error("A conta Microsoft conectada nao possui email.");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("email_integrations").upsert(
    {
      company_id: companyId,
      user_profile_id: userProfileId,
      provider: "microsoft",
      provider_user_id: profile.id,
      email,
      display_name: profile.displayName,
      encrypted_access_token: encryptEmailSecret(accessToken),
      encrypted_refresh_token: encryptEmailSecret(refreshToken),
      token_expires_at: tokenExpiresAt(expiresIn),
      scopes: scope.split(" ").filter(Boolean),
      connected_at: new Date().toISOString(),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "company_id,user_profile_id,provider",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    email,
    displayName: profile.displayName,
  };
}

export async function getMicrosoftIntegrationForUser(
  companyId: string,
  userProfileId: string,
) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("email_integrations")
    .select("*")
    .eq("company_id", companyId)
    .eq("user_profile_id", userProfileId)
    .eq("provider", "microsoft")
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as EmailIntegration | null;
}

export async function getValidMicrosoftAccessToken(
  companyId: string,
  userProfileId: string,
) {
  const integration = await getMicrosoftIntegrationForUser(companyId, userProfileId);

  if (!integration) {
    throw new Error("O Adm responsavel ainda nao conectou o Outlook.");
  }

  if (new Date(integration.token_expires_at).getTime() > Date.now()) {
    return {
      accessToken: decryptEmailSecret(integration.encrypted_access_token),
      integration,
    };
  }

  const refreshToken = decryptEmailSecret(integration.encrypted_refresh_token);
  const refreshed = await refreshMicrosoftAccessToken(refreshToken);
  const nextRefreshToken = refreshed.refresh_token || refreshToken;
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("email_integrations")
    .update({
      encrypted_access_token: encryptEmailSecret(refreshed.access_token),
      encrypted_refresh_token: encryptEmailSecret(nextRefreshToken),
      token_expires_at: tokenExpiresAt(refreshed.expires_in),
      scopes: refreshed.scope.split(" ").filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    accessToken: refreshed.access_token,
    integration: {
      ...integration,
      token_expires_at: tokenExpiresAt(refreshed.expires_in),
      encrypted_access_token: encryptEmailSecret(refreshed.access_token),
      encrypted_refresh_token: encryptEmailSecret(nextRefreshToken),
    },
  };
}

export async function disconnectMicrosoftIntegration(
  companyId: string,
  userProfileId: string,
) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("email_integrations")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("user_profile_id", userProfileId)
    .eq("provider", "microsoft")
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markMicrosoftIntegrationUsed(
  companyId: string,
  integrationId: string,
) {
  const adminClient = createAdminClient();
  await adminClient
    .from("email_integrations")
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("company_id", companyId);
}
