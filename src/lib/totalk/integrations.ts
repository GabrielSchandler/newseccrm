import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptEmailSecret, encryptEmailSecret } from "@/lib/email/crypto";
import type { TotalkIntegration, TotalkIntegrationStatus } from "@/types/totalk";

export type ActiveTotalkIntegration = TotalkIntegrationStatus & {
  apiToken: string;
};

type SaveTotalkIntegrationInput = {
  companyId: string;
  userProfileId: string;
  apiBaseUrl: string;
  apiToken?: string | null;
  defaultSenderPhone?: string | null;
  defaultSendMessage?: string | null;
};

function isMissingTotalkTableError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return (
    message.toLowerCase().includes("totalk_integrations") &&
    (message.toLowerCase().includes("could not find") ||
      message.toLowerCase().includes("schema cache") ||
      message.toLowerCase().includes("does not exist"))
  );
}

export function normalizeTotalkBaseUrl(value: string | null | undefined) {
  const rawValue = value?.trim() || "https://api.app.totalk.chat";
  const withProtocol = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  return withProtocol.replace(/\/+$/, "");
}

function normalizeStatus(row: TotalkIntegration): TotalkIntegrationStatus {
  return {
    id: row.id,
    apiBaseUrl: row.api_base_url,
    defaultSenderPhone: row.default_sender_phone,
    defaultSendMessage: row.default_send_message,
    isActive: row.is_active !== false,
    lastImportAt: row.last_import_at,
    lastSentAt: row.last_sent_at,
    updatedAt: row.updated_at,
  };
}

export async function getTotalkIntegrationStatus(companyId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("totalk_integrations")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    if (isMissingTotalkTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? normalizeStatus(data as TotalkIntegration) : null;
}

export async function getActiveTotalkIntegration(companyId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("totalk_integrations")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingTotalkTableError(error)) {
      throw new Error(
        "A integração Totalk ainda não foi criada no banco. Rode o SQL docs/sql/totalk-integracao.sql.",
      );
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("A integração Totalk ainda não está configurada para esta empresa.");
  }

  const row = data as TotalkIntegration;

  return {
    ...normalizeStatus(row),
    apiToken: decryptEmailSecret(row.encrypted_api_token),
  } satisfies ActiveTotalkIntegration;
}

export async function saveTotalkIntegration(input: SaveTotalkIntegrationInput) {
  const adminClient = createAdminClient();
  const apiBaseUrl = normalizeTotalkBaseUrl(input.apiBaseUrl);
  const trimmedToken = input.apiToken?.trim();
  const { data: existing, error: existingError } = await adminClient
    .from("totalk_integrations")
    .select("*")
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (existingError) {
    if (isMissingTotalkTableError(existingError)) {
      throw new Error(
        "A tabela public.totalk_integrations ainda não existe. Rode docs/sql/totalk-integracao.sql no Supabase.",
      );
    }

    throw new Error(existingError.message);
  }

  if (!trimmedToken && !existing) {
    throw new Error("Informe o token da Totalk para conectar a primeira vez.");
  }

  const payload = {
    company_id: input.companyId,
    api_base_url: apiBaseUrl,
    encrypted_api_token: trimmedToken
      ? encryptEmailSecret(trimmedToken)
      : (existing as TotalkIntegration).encrypted_api_token,
    default_sender_phone: input.defaultSenderPhone?.trim() || null,
    default_send_message: input.defaultSendMessage?.trim() || null,
    is_active: true,
    connected_by: input.userProfileId,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? adminClient
        .from("totalk_integrations")
        .update(payload)
        .eq("company_id", input.companyId)
        .select("*")
        .single()
    : adminClient
        .from("totalk_integrations")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await query;

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível salvar a integração Totalk.");
  }

  return normalizeStatus(data as TotalkIntegration);
}

export async function disconnectTotalkIntegration(companyId: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("totalk_integrations")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (error) {
    if (isMissingTotalkTableError(error)) {
      return;
    }

    throw new Error(error.message);
  }
}

export async function markTotalkImportUsed(companyId: string) {
  const adminClient = createAdminClient();
  await adminClient
    .from("totalk_integrations")
    .update({
      last_import_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);
}

export async function markTotalkSent(companyId: string) {
  const adminClient = createAdminClient();
  await adminClient
    .from("totalk_integrations")
    .update({
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);
}
