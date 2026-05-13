import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayName } from "@/lib/users/account";
import type { CompanyBusinessArea, CompanyUserRole } from "@/types/user";
import type { ClientTimelineEvent, ClientTimelineEventType } from "@/types/client-timeline";

type TimelineDetails = Record<string, unknown> | null | undefined;

type RecordClientTimelineEventInput = {
  companyId: string;
  clientId: string;
  preSaleId?: string | null;
  eventType: ClientTimelineEventType;
  title: string;
  note?: string | null;
  actorUserProfileId?: string | null;
  actorRole?: CompanyUserRole | string | null;
  actorBusinessArea?: CompanyBusinessArea | string | null;
  actorName?: string | null;
  actor?: {
    full_name?: string | null;
    nickname?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  details?: TimelineDetails;
};

function sanitizeDetails(details: TimelineDetails) {
  if (!details) {
    return {};
  }

  return JSON.parse(
    JSON.stringify(details, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }

      if (typeof value === "bigint") {
        return value.toString();
      }

      return value;
    }),
  ) as Record<string, unknown>;
}

export async function recordClientTimelineEvent({
  companyId,
  clientId,
  preSaleId = null,
  eventType,
  title,
  note = null,
  actorUserProfileId = null,
  actorRole = null,
  actorBusinessArea = null,
  actorName = null,
  actor = null,
  details = null,
}: RecordClientTimelineEventInput) {
  const adminSupabase = createAdminClient();
  const derivedActorName =
    actorName ??
    resolveUserDisplayName(actor ?? null, "") ??
    null;

  const { error } = await adminSupabase.from("client_timeline_events").insert({
    company_id: companyId,
    client_id: clientId,
    pre_sale_id: preSaleId,
    event_type: eventType,
    title,
    note: note?.trim() || null,
    actor_user_profile_id: actorUserProfileId,
    actor_role: actorRole,
    actor_business_area: actorBusinessArea,
    actor_name: derivedActorName,
    details: sanitizeDetails(details),
  });

  if (error) {
    console.error("[client-timeline] failed to record event", {
      companyId,
      clientId,
      preSaleId,
      eventType,
      title,
      message: error.message,
    });
  }
}

export async function listClientTimelineEvents(companyId: string, clientId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("client_timeline_events")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientTimelineEvent[];
}
