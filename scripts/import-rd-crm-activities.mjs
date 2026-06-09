import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

const RD_CRM_BASE_URL = "https://crm.rdstation.com/api/v1";
const SOURCE = "rd_station_crm";

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function normalizeSupabaseUrl(value) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("sb_publishable_") || raw.startsWith("eyJ")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL esta com uma chave e nao com a URL do projeto. Use algo como https://SEU-PROJETO.supabase.co",
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL invalida. Use a URL base do projeto, por exemplo https://SEU-PROJETO.supabase.co",
    );
  }

  return parsedUrl.origin;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeCpf(value) {
  const digits = onlyDigits(value);
  return digits.length === 11 ? digits : null;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeComparableName(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalized.length >= 6 ? normalized : null;
}

function parseLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sanitizeForLog(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value);
  return text.length > 280 ? `${text.slice(0, 280)}...` : text;
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractArray(payload, preferredKeys) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of preferredKeys) {
    const value = payload?.[key];

    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      const nested = extractArray(value, preferredKeys);

      if (nested.length) {
        return nested;
      }
    }
  }

  if (payload && typeof payload === "object") {
    const arrays = Object.values(payload).filter(Array.isArray);

    if (arrays.length === 1) {
      return arrays[0];
    }
  }

  return [];
}

function getAny(object, keys) {
  for (const key of keys) {
    const value = object?.[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function extractActivityId(activity) {
  return String(getAny(activity, ["id", "_id", "uuid", "activity_id"]) ?? "").trim();
}

function extractDealId(activity) {
  const direct = getAny(activity, ["deal_id", "dealId", "deal_uuid", "opportunity_id"]);

  if (direct) {
    return String(direct).trim();
  }

  const deal = activity?.deal || activity?.deal_reference || activity?.opportunity;
  return String(getAny(deal, ["id", "_id", "uuid"]) ?? "").trim() || null;
}

function extractContactId(activity, deal) {
  const direct = getAny(activity, ["contact_id", "contactId"]);

  if (direct) {
    return String(direct).trim();
  }

  const contacts = [
    ...(Array.isArray(activity?.contacts) ? activity.contacts : []),
    ...(Array.isArray(deal?.contacts) ? deal.contacts : []),
  ];

  return String(getAny(contacts[0], ["id", "_id", "uuid"]) ?? "").trim() || null;
}

function extractActivityText(activity) {
  return normalizeText(
    getAny(activity, [
      "text",
      "content",
      "description",
      "note",
      "body",
      "message",
      "title",
      "subject",
    ]),
  );
}

function extractActivityCreatedAt(activity) {
  return parseDateTime(
    getAny(activity, [
      "created_at",
      "date",
      "activity_date",
      "inserted_at",
      "updated_at",
      "happened_at",
    ]),
  );
}

function extractActorName(activity) {
  const direct = normalizeText(getAny(activity, ["user_name", "author_name", "owner_name"]));

  if (direct) {
    return direct;
  }

  const user = activity?.user || activity?.author || activity?.owner;
  return normalizeText(getAny(user, ["name", "full_name", "email", "username"]));
}

function extractDealName(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const direct = normalizeText(getAny(value, ["deal_name", "opportunity_name"]));

  if (direct) {
    return direct;
  }

  const deal = value.deal || value.deal_reference || value.opportunity;
  const nested = normalizeText(getAny(deal, ["name", "full_name", "title"]));

  if (nested) {
    return nested;
  }

  return normalizeText(getAny(value, ["name", "title"]));
}

function extractClientNameFromText(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(?:^|\n)\s*Nome\s*:\s*([^\n\r]+)/i);
  return match ? normalizeText(match[1]) : null;
}

function extractClientName(activity, deal = null) {
  return (
    extractDealName(deal) ??
    extractDealName(activity) ??
    extractClientNameFromText(extractActivityText(activity))
  );
}

function hasCpfHint(key, object) {
  const normalizedKey = String(key ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (normalizedKey.includes("cpf")) {
    return true;
  }

  if (!object || typeof object !== "object") {
    return false;
  }

  const label = String(
    object.label ?? object.name ?? object.field ?? object.custom_field_label ?? "",
  )
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return label.includes("cpf");
}

function findCpfInObject(value, hinted = false, visited = new WeakSet()) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    const digits = onlyDigits(text);

    if (hinted) {
      return normalizeCpf(digits);
    }

    const match = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    return match ? normalizeCpf(match[0]) : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }

  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const cpf = findCpfInObject(item, hinted, visited);

      if (cpf) {
        return cpf;
      }
    }

    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextHinted = hinted || hasCpfHint(key, value);
    const cpf = findCpfInObject(nestedValue, nextHinted, visited);

    if (cpf) {
      return cpf;
    }
  }

  return null;
}

function getRetryAfterMs(response) {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryDate = new Date(retryAfter);
  const retryMs = retryDate.getTime() - Date.now();
  return Number.isFinite(retryMs) && retryMs > 0 ? retryMs : null;
}

function shouldRetryRdStatus(status) {
  return status === 429 || status >= 500;
}

async function rdFetch(path, token, params = {}, options = {}) {
  const url = new URL(`${RD_CRM_BASE_URL}/${path.replace(/^\/+/, "")}`);
  url.searchParams.set("token", token);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const retryCount = parseNonNegativeInteger(options.retryCount, 3);
  const retryDelayMs = parseNonNegativeInteger(options.retryDelayMs, 1500);

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
    });

    const responseText = await response.text();
    let payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { raw: responseText };
      }
    }

    if (response.ok) {
      return payload;
    }

    if (attempt < retryCount && shouldRetryRdStatus(response.status)) {
      const retryAfterMs = getRetryAfterMs(response);
      const waitMs = retryAfterMs ?? retryDelayMs * (attempt + 1);
      console.warn(
        `RD CRM retornou HTTP ${response.status}. Nova tentativa em ${waitMs}ms (${attempt + 1}/${retryCount}).`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(
      `RD CRM retornou HTTP ${response.status}: ${sanitizeForLog(
        payload?.message ?? payload?.error ?? responseText,
      )}`,
    );
  }

  return null;
}

async function fetchActivities({
  token,
  limit,
  pageSize,
  startDate,
  endDate,
  dealId,
  requestOptions,
  pageDelayMs,
}) {
  const collected = [];
  let page = 1;

  while (collected.length < limit) {
    const payload = await rdFetch("activities", token, {
      page,
      limit: Math.min(pageSize, limit - collected.length),
      start_date: startDate,
      end_date: endDate,
      deal_id: dealId,
    }, requestOptions);
    const activities = extractArray(payload, ["activities", "data", "results", "items"]);

    if (!activities.length) {
      break;
    }

    collected.push(...activities);

    if (activities.length < Math.min(pageSize, limit - collected.length + activities.length)) {
      break;
    }

    page += 1;

    if (pageDelayMs > 0) {
      await sleep(pageDelayMs);
    }
  }

  return collected.slice(0, limit);
}

async function fetchDeals({
  token,
  limit,
  pageSize,
  requestOptions,
  pageDelayMs,
}) {
  const collected = [];
  let page = 1;
  let nextPage = null;

  while (collected.length < limit) {
    const payload = await rdFetch("deals", token, {
      page,
      limit: Math.min(pageSize, limit - collected.length),
      order: "created_at",
      direction: "desc",
      next_page: nextPage,
    }, requestOptions);
    const deals = extractArray(payload, ["deals", "data", "results", "items"]);

    if (!deals.length) {
      break;
    }

    collected.push(...deals);

    nextPage = normalizeText(payload?.next_page);
    const hasMore = payload?.has_more;

    const expectedPageSize = Math.min(pageSize, limit - collected.length + deals.length);

    if (!nextPage && (hasMore === false || deals.length < expectedPageSize)) {
      break;
    }

    page += 1;

    if (pageDelayMs > 0) {
      await sleep(pageDelayMs);
    }
  }

  return collected.slice(0, limit);
}

async function fetchActivitiesFromDeals({
  token,
  deals,
  perDealLimit,
  pageSize,
  startDate,
  endDate,
  requestOptions,
  pageDelayMs,
  dealDelayMs,
  dealCache,
}) {
  const byId = new Map();

  for (const [index, deal] of deals.entries()) {
    const dealId = extractDealId(deal) || String(getAny(deal, ["id", "_id"]) ?? "").trim();

    if (!dealId) {
      continue;
    }

    dealCache.set(dealId, deal);

    if (dealDelayMs > 0 && index > 0) {
      await sleep(dealDelayMs);
    }

    const dealActivities = await fetchActivities({
      token,
      limit: perDealLimit,
      pageSize,
      startDate,
      endDate,
      dealId,
      requestOptions,
      pageDelayMs,
    });

    for (const [activityIndex, activity] of dealActivities.entries()) {
      const activityId =
        extractActivityId(activity) || `sem-id-${dealId}-${activityIndex + 1}`;

      if (!byId.has(activityId)) {
        byId.set(activityId, activity);
      }
    }
  }

  return Array.from(byId.values());
}

async function fetchDeal(token, dealId, cache, requestOptions = {}) {
  if (!dealId) {
    return null;
  }

  if (cache.has(dealId)) {
    return cache.get(dealId);
  }

  try {
    const requestDelayMs = parseNonNegativeInteger(requestOptions.requestDelayMs, 0);

    if (requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }

    const deal = await rdFetch(`deals/${encodeURIComponent(dealId)}`, token, {}, requestOptions);
    cache.set(dealId, deal);
    return deal;
  } catch (error) {
    cache.set(dealId, null);
    throw error;
  }
}

function buildDealCpfMap(activities, deals = []) {
  const map = new Map();

  for (const deal of deals) {
    const rdDealId = extractDealId(deal) || String(getAny(deal, ["id", "_id"]) ?? "").trim();
    const cpf = findCpfInObject(deal);

    if (rdDealId && cpf && !map.has(rdDealId)) {
      map.set(rdDealId, cpf);
    }
  }

  for (const activity of activities) {
    const rdDealId = extractDealId(activity);
    const cpf = findCpfInObject(activity);

    if (rdDealId && cpf && !map.has(rdDealId)) {
      map.set(rdDealId, cpf);
    }
  }

  return map;
}

function buildDealNameMap(activities, deals = []) {
  const map = new Map();

  for (const deal of deals) {
    const rdDealId = extractDealId(deal) || String(getAny(deal, ["id", "_id"]) ?? "").trim();
    const name = extractClientName(null, deal);

    if (rdDealId && name && !map.has(rdDealId)) {
      map.set(rdDealId, name);
    }
  }

  for (const activity of activities) {
    const rdDealId = extractDealId(activity);
    const name = extractClientName(activity);

    if (rdDealId && name && !map.has(rdDealId)) {
      map.set(rdDealId, name);
    }
  }

  return map;
}

async function findClientByCpf(supabase, companyId, cpf) {
  if (!cpf) {
    return {
      status: "missing_cpf",
      client: null,
      message: "CPF nao encontrado na anotacao/negociacao do RD.",
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, cpf")
    .eq("company_id", companyId)
    .eq("cpf", cpf)
    .is("deleted_at", null)
    .limit(2);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    return {
      status: "client_not_found",
      client: null,
      message: `Cliente nao encontrado no CRM para CPF ${cpf}.`,
    };
  }

  if (data.length > 1) {
    return {
      status: "duplicate_client",
      client: null,
      message: `Mais de um cliente ativo encontrado no CRM para CPF ${cpf}.`,
    };
  }

  return {
    status: "matched",
    client: data[0],
    message: null,
  };
}

async function findClientByName(supabase, companyId, name) {
  const comparableName = normalizeComparableName(name);

  if (!comparableName) {
    return {
      status: "missing_name",
      client: null,
      message: "Nome do cliente nao encontrado na anotacao/negociacao do RD.",
    };
  }

  const firstToken = comparableName.split(" ")[0];
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, cpf")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .ilike("full_name", `%${firstToken}%`)
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const matches = (data ?? []).filter(
    (client) => normalizeComparableName(client.full_name) === comparableName,
  );

  if (!matches.length) {
    return {
      status: "client_not_found_by_name",
      client: null,
      message: `Cliente nao encontrado no CRM para nome ${name}.`,
    };
  }

  if (matches.length > 1) {
    return {
      status: "duplicate_client_name",
      client: null,
      message: `Mais de um cliente ativo encontrado no CRM para nome ${name}.`,
    };
  }

  return {
    status: "matched",
    client: matches[0],
    message: null,
  };
}

async function findClientMatch(supabase, companyId, { cpf, name }) {
  const cpfMatch = await findClientByCpf(supabase, companyId, cpf);

  if (cpfMatch.client) {
    return {
      ...cpfMatch,
      matchedBy: "cpf",
      matchValue: cpf,
    };
  }

  if (cpfMatch.status === "duplicate_client") {
    return {
      ...cpfMatch,
      matchedBy: null,
      matchValue: null,
    };
  }

  const nameMatch = await findClientByName(supabase, companyId, name);

  if (nameMatch.client) {
    return {
      ...nameMatch,
      matchedBy: "name",
      matchValue: name,
      cpfErrorMessage: cpfMatch.message,
    };
  }

  return {
    ...nameMatch,
    matchedBy: null,
    matchValue: null,
    message: `${cpfMatch.message} ${nameMatch.message}`,
  };
}

async function createBatch(supabase, { companyId, createdBy, notes }) {
  const { data, error } = await supabase
    .from("rd_crm_activity_import_batches")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      import_status: "processing",
      notes,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

async function finishBatch(supabase, batchId, status) {
  const { error } = await supabase
    .from("rd_crm_activity_import_batches")
    .update({
      import_status: status,
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchImportRowsByBatch(supabase, { companyId, batchId }) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("rd_crm_activity_import")
      .select("id, import_status, timeline_event_id")
      .eq("company_id", companyId)
      .eq("batch_id", batchId)
      .not("timeline_event_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function rollbackBatch(supabase, { companyId, batchId }) {
  const rows = await fetchImportRowsByBatch(supabase, { companyId, batchId });
  const importedRows = rows.filter(
    (row) => row.import_status === "imported" && row.timeline_event_id,
  );
  const timelineEventIds = Array.from(
    new Set(importedRows.map((row) => row.timeline_event_id).filter(Boolean)),
  );
  const importRowIds = importedRows.map((row) => row.id);

  for (const chunk of chunkArray(timelineEventIds, 200)) {
    const { error } = await supabase
      .from("client_timeline_events")
      .delete()
      .eq("company_id", companyId)
      .in("id", chunk);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rolledBackAt = new Date().toISOString();

  for (const chunk of chunkArray(importRowIds, 200)) {
    const { error } = await supabase
      .from("rd_crm_activity_import")
      .update({
        import_status: "rolled_back",
        timeline_event_id: null,
        rolled_back_at: rolledBackAt,
        updated_at: rolledBackAt,
      })
      .eq("company_id", companyId)
      .in("id", chunk);

    if (error) {
      throw new Error(error.message);
    }
  }

  await finishBatch(supabase, batchId, "rolled_back");

  return {
    batchId,
    scanned: rows.length,
    rolledBackImports: importRowIds.length,
    deletedTimelineEvents: timelineEventIds.length,
  };
}

async function getExistingImport(supabase, companyId, rdActivityId) {
  const { data, error } = await supabase
    .from("rd_crm_activity_import")
    .select("id, import_status, timeline_event_id")
    .eq("company_id", companyId)
    .eq("rd_activity_id", rdActivityId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function saveImportRow(supabase, payload, existingId = null) {
  async function updateExistingImport(importId, nextPayload) {
    const { error } = await supabase
      .from("rd_crm_activity_import")
      .update({
        ...nextPayload,
        updated_at: new Date().toISOString(),
        rolled_back_at: null,
      })
      .eq("id", importId);

    if (error) {
      throw new Error(error.message);
    }

    return importId;
  }

  if (existingId) {
    return updateExistingImport(existingId, payload);
  }

  const { data, error } = await supabase
    .from("rd_crm_activity_import")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    const isDuplicate =
      error.code === "23505" ||
      String(error.message ?? "").includes("duplicate key value");

    if (isDuplicate) {
      const existing = await getExistingImport(supabase, payload.company_id, payload.rd_activity_id);

      if (existing?.id) {
        if (
          existing.timeline_event_id &&
          payload.timeline_event_id &&
          existing.timeline_event_id !== payload.timeline_event_id
        ) {
          await supabase
            .from("client_timeline_events")
            .delete()
            .eq("id", payload.timeline_event_id)
            .eq("company_id", payload.company_id);

          return updateExistingImport(existing.id, {
            ...payload,
            timeline_event_id: existing.timeline_event_id,
          });
        }

        return updateExistingImport(existing.id, payload);
      }
    }

    throw new Error(error.message);
  }

  return data.id;
}

async function insertTimelineEvent(
  supabase,
  {
    companyId,
    clientId,
    createdBy,
    note,
    createdAt,
    actorName,
    details,
  },
) {
  const { data, error } = await supabase
    .from("client_timeline_events")
    .insert({
      company_id: companyId,
      client_id: clientId,
      event_type: "manual_note",
      title: "Anotacao importada do RD Station",
      note,
      actor_user_profile_id: createdBy,
      actor_role: "admin",
      actor_business_area: "management",
      actor_name: actorName ? `RD Station CRM - ${actorName}` : "RD Station CRM",
      details,
      created_at: createdAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

async function updateTimelineEvent(
  supabase,
  {
    timelineEventId,
    note,
    createdAt,
    actorName,
    details,
  },
) {
  const { error } = await supabase
    .from("client_timeline_events")
    .update({
      title: "Anotacao importada do RD Station",
      note,
      actor_name: actorName ? `RD Station CRM - ${actorName}` : "RD Station CRM",
      details,
      created_at: createdAt ?? new Date().toISOString(),
    })
    .eq("id", timelineEventId);

  if (error) {
    throw new Error(error.message);
  }
}

function buildImportPayload({
  batchId,
  companyId,
  activity,
  rdActivityId,
  rdDealId,
  rdContactId,
  cpf,
  match,
  matchedBy,
  matchValue,
  timelineEventId,
  status,
  errorMessage,
}) {
  return {
    batch_id: batchId,
    company_id: companyId,
    rd_activity_id: rdActivityId,
    rd_deal_id: rdDealId,
    rd_contact_id: rdContactId,
    rd_client_cpf: cpf,
    matched_client_id: match.client?.id ?? null,
    timeline_event_id: timelineEventId,
    matched_by: match.client ? matchedBy : null,
    match_value: match.client ? matchValue : null,
    import_status: status,
    error_message: errorMessage,
    raw_payload: activity,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isApply = Boolean(args.apply);
  const shouldRepair = Boolean(args.repair || args["update-existing"]);
  const rollbackBatchId = normalizeText(args["rollback-batch"] ?? args.rollback);

  loadEnvConfig(process.cwd());

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = String(args.token ?? process.env.RD_CRM_TOKEN ?? "").trim();
  const companyId = String(args["company-id"] ?? "").trim();
  const createdBy = String(args["created-by"] ?? "").trim();
  const limit = parseLimit(args.limit, 20);
  const pageSize = Math.min(parseLimit(args["page-size"], 200), 200);
  const scanDeals = Boolean(args["scan-deals"] || args["por-negociacao"]);
  const dealLimit = parseLimit(args["deal-limit"], limit);
  const perDealLimit = parseLimit(args["per-deal-limit"], 1000);
  const retryCount = parseNonNegativeInteger(args["retry-count"], 5);
  const retryDelayMs = parseNonNegativeInteger(args["retry-delay-ms"], 3000);
  const pageDelayMs = parseNonNegativeInteger(args["page-delay-ms"], 750);
  const dealDelayMs = parseNonNegativeInteger(args["deal-delay-ms"], 350);
  const startDate = normalizeText(args["start-date"]);
  const endDate = normalizeText(args["end-date"]);
  const dealIdFilter = normalizeText(args["deal-id"] ?? args.deal);
  const cpfFilterRaw = args.cpf ?? args["client-cpf"];
  const cpfFilter = cpfFilterRaw ? normalizeCpf(cpfFilterRaw) : null;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variaveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias.");
  }

  if (!companyId) {
    throw new Error("Informe --company-id.");
  }

  if (rollbackBatchId) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const rollbackSummary = await rollbackBatch(supabase, {
      companyId,
      batchId: rollbackBatchId,
    });
    console.log("Rollback de importacao RD concluido:");
    console.log(JSON.stringify(rollbackSummary, null, 2));
    return;
  }

  if (!token) {
    throw new Error("Informe o token com --token ou pela variavel RD_CRM_TOKEN.");
  }

  if (isApply && !createdBy) {
    throw new Error("Informe --created-by para aplicar a importacao.");
  }

  if (cpfFilterRaw && !cpfFilter) {
    throw new Error("CPF informado em --cpf invalido. Use um CPF com 11 digitos.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const dealCache = new Map();
  const requestOptions = {
    retryCount,
    retryDelayMs,
  };
  const dealRequestOptions = {
    ...requestOptions,
    requestDelayMs: dealDelayMs,
  };
  let scannedDeals = [];
  let activities = [];

  if (scanDeals && !dealIdFilter) {
    scannedDeals = await fetchDeals({
      token,
      limit: dealLimit,
      pageSize,
      requestOptions,
      pageDelayMs,
    });
    activities = await fetchActivitiesFromDeals({
      token,
      deals: scannedDeals,
      perDealLimit,
      pageSize,
      startDate,
      endDate,
      requestOptions,
      pageDelayMs,
      dealDelayMs,
      dealCache,
    });
  } else {
    activities = await fetchActivities({
      token,
      limit,
      pageSize,
      startDate,
      endDate,
      dealId: dealIdFilter,
      requestOptions,
      pageDelayMs,
    });
  }
  const summary = {
    scanned: activities.length,
    total: 0,
    matched: 0,
    matchedByCpf: 0,
    matchedByName: 0,
    imported: 0,
    repaired: 0,
    skipped: 0,
    errors: 0,
  };
  let batchId = null;
  const dealCpfMap = buildDealCpfMap(activities, scannedDeals);
  const dealNameMap = buildDealNameMap(activities, scannedDeals);

  console.log(`RD CRM - anotações encontradas: ${activities.length}`);
  if (scanDeals && !dealIdFilter) {
    console.log(`Modo de varredura: por negociacao (${scannedDeals.length} negociacoes lidas)`);
  } else {
    console.log("Modo de varredura: anotacoes gerais");
  }
  if (cpfFilter) {
    console.log(`Filtro CPF: ${cpfFilter}`);
  }
  if (dealIdFilter) {
    console.log(`Filtro negociacao RD: ${dealIdFilter}`);
  }
  console.log(`Negociacoes RD com CPF identificado: ${dealCpfMap.size}`);
  console.log(`Negociacoes RD com nome identificado: ${dealNameMap.size}`);
  console.log(
    `Controle RD: retry=${retryCount}, retryDelayMs=${retryDelayMs}, pageDelayMs=${pageDelayMs}, dealDelayMs=${dealDelayMs}`,
  );
  console.log(`Modo: ${isApply ? "APLICAR" : "DIAGNOSTICO"}`);

  if (isApply) {
    const batchNotes = [
      `Importacao de anotacoes RD CRM. Modo: ${scanDeals && !dealIdFilter ? "por negociacao" : "geral"}.`,
      `Limite: ${limit}.`,
      scanDeals && !dealIdFilter
        ? `Negociacoes: ${dealLimit}. Por negociacao: ${perDealLimit}.`
        : "",
      cpfFilter ? `CPF: ${cpfFilter}.` : "",
      dealIdFilter ? `Negociacao RD: ${dealIdFilter}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    batchId = await createBatch(supabase, {
      companyId,
      createdBy,
      notes: batchNotes,
    });
    console.log(`Batch criado: ${batchId}`);
  }

  const examples = [];

  for (const [index, activity] of activities.entries()) {
    const rdActivityId = extractActivityId(activity) || `sem-id-${index + 1}`;
    const rdDealId = extractDealId(activity);
    let deal = null;
    let status = "pending";
    let timelineEventId = null;
    let existing = null;
    let errorMessage = null;
    let cpf = null;
    let clientName = null;

    try {
      if (dealIdFilter && cpfFilter) {
        cpf = cpfFilter;
      } else {
        cpf = findCpfInObject(activity) ?? (rdDealId ? dealCpfMap.get(rdDealId) : null) ?? null;
      }

      if (!dealIdFilter && cpfFilter && cpf && cpf !== cpfFilter) {
        continue;
      }

      if (rdDealId && !cpf) {
        deal = await fetchDeal(token, rdDealId, dealCache, dealRequestOptions);
        cpf = findCpfInObject(deal);

        if (cpf) {
          dealCpfMap.set(rdDealId, cpf);
        }
      }

      if (cpfFilter && cpf !== cpfFilter) {
        continue;
      }

      summary.total += 1;

      const note = extractActivityText(activity);
      const createdAt = extractActivityCreatedAt(activity);
      const actorName = extractActorName(activity);

      clientName =
        extractClientName(activity, deal) ?? (rdDealId ? dealNameMap.get(rdDealId) : null) ?? null;

      if (rdDealId && !clientName) {
        deal = await fetchDeal(token, rdDealId, dealCache, dealRequestOptions);
        clientName = extractClientName(activity, deal);

        if (clientName) {
          dealNameMap.set(rdDealId, clientName);
        }
      }

      const rdContactId = extractContactId(activity, deal);
      const match = await findClientMatch(supabase, companyId, {
        cpf,
        name: clientName,
      });

      if (match.client) {
        summary.matched += 1;

        if (match.matchedBy === "cpf") {
          summary.matchedByCpf += 1;
        }

        if (match.matchedBy === "name") {
          summary.matchedByName += 1;
        }
      }

      if (!note) {
        throw new Error("Anotacao sem texto identificavel.");
      }

      if (isApply) {
        existing = await getExistingImport(supabase, companyId, rdActivityId);
      }

      const timelineDetails = {
        source: SOURCE,
        rd_import_batch_id: batchId,
        rd_activity_id: rdActivityId,
        rd_deal_id: rdDealId,
        rd_contact_id: rdContactId,
        rd_client_cpf: cpf,
        rd_client_name: clientName,
        rd_created_at: createdAt,
        rd_actor_name: actorName,
        matched_by: match.matchedBy,
        match_value: match.matchValue,
      };

      if (!match.client) {
        status = "error";
        errorMessage = match.message;
        summary.errors += 1;
      } else if (isApply && existing?.import_status === "imported" && existing.timeline_event_id) {
        if (shouldRepair) {
          await updateTimelineEvent(supabase, {
            timelineEventId: existing.timeline_event_id,
            note,
            createdAt,
            actorName,
            details: timelineDetails,
          });
          timelineEventId = existing.timeline_event_id;
          status = "imported";
          summary.repaired += 1;
        } else {
          summary.skipped += 1;
          continue;
        }
      } else if (isApply) {
        timelineEventId = await insertTimelineEvent(supabase, {
          companyId,
          clientId: match.client.id,
          createdBy,
          note,
          createdAt,
          actorName,
          details: timelineDetails,
        });
        status = "imported";
        summary.imported += 1;
      }

      if (isApply) {
        await saveImportRow(
          supabase,
          buildImportPayload({
            batchId,
            companyId,
            activity,
            rdActivityId,
            rdDealId,
            rdContactId,
            cpf,
            match,
            matchedBy: match.matchedBy,
            matchValue: match.matchValue,
            timelineEventId,
            status,
            errorMessage,
          }),
          existing?.id ?? null,
        );
      }

      if (examples.length < 5) {
        examples.push({
          rdActivityId,
          rdDealId,
          cpf,
          clientName,
          matchedBy: match.matchedBy,
          matchedClient: match.client?.full_name ?? null,
          status: isApply ? status : match.status,
          notePreview: sanitizeForLog(note),
          createdAt,
          actorName,
        });
      }
    } catch (error) {
      summary.errors += 1;
      errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";

      if (isApply) {
        await saveImportRow(
          supabase,
          buildImportPayload({
            batchId,
            companyId,
            activity,
            rdActivityId,
            rdDealId,
            rdContactId: null,
            cpf: cpf ?? findCpfInObject(activity),
            match: { client: null },
            timelineEventId: null,
            status: "error",
            errorMessage,
          }),
          existing?.id ?? null,
        );
      }

      if (examples.length < 5) {
        examples.push({
          rdActivityId,
          rdDealId,
          status: "error",
          error: sanitizeForLog(errorMessage),
        });
      }
    }
  }

  if (isApply && batchId) {
    await finishBatch(supabase, batchId, summary.errors ? "finished_with_errors" : "imported");
  }

  console.log("\nExemplos:");
  console.log(JSON.stringify(examples, null, 2));
  console.log("\nResumo:");
  console.log(JSON.stringify({ batchId, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
  process.exitCode = 1;
});
