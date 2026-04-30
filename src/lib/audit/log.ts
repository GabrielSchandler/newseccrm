type AuditSupabaseLike = {
  from: (table: string) => {
    insert: (
      values: Record<string, unknown>,
    ) => PromiseLike<{ error: { message?: string } | null }>;
  };
};

type AuditLogInput = {
  supabase: AuditSupabaseLike;
  companyId: string;
  userProfileId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown> | null;
};

function sanitizeDetails(details: Record<string, unknown> | null | undefined) {
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

export function canAccessAuditLogs(role: string | null) {
  return role === "admin";
}

export async function recordAuditLog({
  supabase,
  companyId,
  userProfileId = null,
  action,
  entityType,
  entityId = null,
  entityLabel = null,
  details = null,
}: AuditLogInput) {
  const { error } = await supabase.from("company_audit_logs").insert({
    company_id: companyId,
    user_profile_id: userProfileId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel,
    details: sanitizeDetails(details),
  });

  if (error) {
    console.error("[audit] failed to record log", {
      action,
      entityType,
      entityId,
      message: error.message,
    });
  }
}
