import "server-only";
import type { EmailDispatchMode } from "@/types/email";

const microsoftScopes = [
  "openid",
  "profile",
  "User.Read",
  "offline_access",
  "Mail.Send",
  "Mail.ReadWrite",
];

type MicrosoftTokenResponse = {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
};

export type MicrosoftUserProfile = {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
};

export type MicrosoftAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

export type MicrosoftEmailPayload = {
  mode: EmailDispatchMode;
  accessToken: string;
  subject: string;
  body: string;
  to: string[];
  cc: string[];
  bcc: string[];
  attachments: MicrosoftAttachment[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }

  return value;
}

export function getMicrosoftOAuthConfig() {
  const tenantId = requiredEnv("MICROSOFT_TENANT_ID");

  return {
    tenantId,
    clientId: requiredEnv("MICROSOFT_CLIENT_ID"),
    clientSecret: requiredEnv("MICROSOFT_CLIENT_SECRET"),
    redirectUri: requiredEnv("MICROSOFT_REDIRECT_URI"),
    authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    scopes: microsoftScopes,
  };
}

export function buildMicrosoftAuthorizeUrl(state: string) {
  const config = getMicrosoftOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: config.scopes.join(" "),
    state,
  });

  return `${config.authorizeUrl}?${params.toString()}`;
}

async function requestMicrosoftToken(params: URLSearchParams) {
  const config = getMicrosoftOAuthConfig();
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });
  const body = (await response.json()) as MicrosoftTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(body.error_description || body.error || "Falha ao conectar Outlook.");
  }

  return body;
}

export async function exchangeMicrosoftCode(code: string) {
  const config = getMicrosoftOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    scope: config.scopes.join(" "),
  });

  return requestMicrosoftToken(params);
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const config = getMicrosoftOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    redirect_uri: config.redirectUri,
    grant_type: "refresh_token",
    scope: config.scopes.join(" "),
  });

  return requestMicrosoftToken(params);
}

export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const body = (await response.json()) as MicrosoftUserProfile & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message || "Nao foi possivel validar a conta Outlook.");
  }

  return body;
}

function mapRecipients(emails: string[]) {
  return emails.map((address) => ({
    emailAddress: {
      address,
    },
  }));
}

function buildMessage(payload: MicrosoftEmailPayload) {
  return {
    subject: payload.subject,
    body: {
      contentType: "HTML",
      content: payload.body.replace(/\n/g, "<br />"),
    },
    toRecipients: mapRecipients(payload.to),
    ccRecipients: mapRecipients(payload.cc),
    bccRecipients: mapRecipients(payload.bcc),
    attachments: payload.attachments.map((attachment) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.name,
      contentType: attachment.contentType,
      contentBytes: attachment.contentBytes,
    })),
  };
}

export async function dispatchMicrosoftEmail(payload: MicrosoftEmailPayload) {
  const message = buildMessage(payload);

  if (payload.mode === "draft") {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
      method: "POST",
      headers: {
        authorization: `Bearer ${payload.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
      cache: "no-store",
    });
    const body = (await response.json()) as { id?: string; error?: { message?: string } };

    if (!response.ok || !body.id) {
      throw new Error(body.error?.message || "Nao foi possivel criar o rascunho no Outlook.");
    }

    return {
      status: "draft_created" as const,
      messageId: body.id,
    };
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      authorization: `Bearer ${payload.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message,
      saveToSentItems: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message || "Nao foi possivel enviar o email pelo Outlook.");
  }

  return {
    status: "sent" as const,
    messageId: null,
  };
}
