import "server-only";
import { onlyDigits } from "@/lib/clients/masks";
import type { ActiveTotalkIntegration } from "@/lib/totalk/integrations";

export type TotalkContactLookupResult = {
  phone: string;
  contactName: string | null;
  annotation: string | null;
  raw: unknown;
};

type SendTotalkDocumentInput = {
  integration: ActiveTotalkIntegration;
  toPhone: string;
  fileUrl: string;
  text: string;
  senderId: string;
};

function buildTotalkUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function getBearerHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function safeJsonString(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function parseTotalkResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function createTotalkError(action: string, response: Response, body: unknown) {
  const details = typeof body === "string" ? body : safeJsonString(body);
  return new Error(
    `Totalk retornou HTTP ${response.status} ao ${action}. ${details}`.trim(),
  );
}

export function normalizeTotalkPhone(value: string | null | undefined) {
  const digits = onlyDigits(value ?? "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function buildPhoneLookupCandidates(phone: string) {
  const normalized = normalizeTotalkPhone(phone);
  const local = onlyDigits(phone).replace(/^55(?=\d{10,11}$)/, "");

  return Array.from(
    new Set([normalized, local].filter((item) => item && item.length >= 10)),
  );
}

function getStringFromRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractNestedText(value: unknown, keyHints: string[], depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractNestedText(item, keyHints, depth + 1);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  const hintedEntry = entries.find(([key, entryValue]) => {
    const normalizedKey = key.toLowerCase();
    return (
      keyHints.some((hint) => normalizedKey.includes(hint)) &&
      typeof entryValue === "string" &&
      entryValue.trim()
    );
  });

  if (hintedEntry) {
    return String(hintedEntry[1]).trim();
  }

  for (const [, entryValue] of entries) {
    const found = extractNestedText(entryValue, keyHints, depth + 1);

    if (found) {
      return found;
    }
  }

  return null;
}

function normalizeContactResponse(body: unknown, phone: string): TotalkContactLookupResult {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const annotation =
    getStringFromRecord(record, ["annotation", "note", "notes", "privateNote"]) ??
    extractNestedText(record, ["annotation", "note", "nota"]);
  const contactName = getStringFromRecord(record, [
    "name",
    "fullName",
    "displayName",
    "contactName",
  ]);

  return {
    phone,
    contactName,
    annotation,
    raw: body,
  };
}

export async function findTotalkContactByPhone(
  integration: ActiveTotalkIntegration,
  phone: string,
) {
  const candidates = buildPhoneLookupCandidates(phone);
  let lastError: Error | null = null;

  if (!candidates.length) {
    throw new Error("Informe um telefone válido para buscar no Totalk.");
  }

  for (const candidate of candidates) {
    const response = await fetch(
      buildTotalkUrl(
        integration.apiBaseUrl,
        `/core/v1/contact/phonenumber/${encodeURIComponent(candidate)}`,
      ),
      {
        method: "GET",
        headers: getBearerHeaders(integration.apiToken),
        cache: "no-store",
      },
    );
    const body = await parseTotalkResponse(response);

    if (response.ok) {
      return normalizeContactResponse(body, candidate);
    }

    lastError = createTotalkError("buscar contato", response, body);

    if (response.status !== 404) {
      break;
    }
  }

  throw lastError ?? new Error("Contato não encontrado no Totalk.");
}

export async function sendTotalkDocument({
  integration,
  toPhone,
  fileUrl,
  text,
  senderId,
}: SendTotalkDocumentInput) {
  const from = normalizeTotalkPhone(integration.defaultSenderPhone);
  const to = normalizeTotalkPhone(toPhone);

  if (!from) {
    throw new Error("Configure o telefone/canal remetente da Totalk em Integrações.");
  }

  if (!to) {
    throw new Error("A simulação não possui telefone válido para envio.");
  }

  const response = await fetch(
    buildTotalkUrl(integration.apiBaseUrl, "/chat/v1/send/document"),
    {
      method: "POST",
      headers: getBearerHeaders(integration.apiToken),
      cache: "no-store",
      body: JSON.stringify({
        to,
        from,
        fileIdOrUrl: fileUrl,
        text,
        options: {
          senderId,
        },
      }),
    },
  );
  const body = await parseTotalkResponse(response);

  if (!response.ok) {
    throw createTotalkError("enviar documento", response, body);
  }

  return body;
}
