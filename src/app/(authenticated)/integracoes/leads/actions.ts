"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { extractGoogleSheetInfo } from "@/lib/leads/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";

function canManageLeadSources(role: string | null, isPlatformOwner: boolean) {
  return isPlatformOwner || role === "admin" || role === "manager";
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeColumn(value: FormDataEntryValue | null, fallback?: string) {
  const text = normalizeText(value);
  return (text ?? fallback ?? "").toUpperCase();
}

function parseStartRow(value: FormDataEntryValue | null) {
  const numericValue = Number(normalizeText(value) ?? 2);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : 2;
}

async function requireLeadSourceManager() {
  const context = await getCurrentUserContext();

  if (!canManageLeadSources(context.role, context.isPlatformOwner)) {
    redirect("/areas");
  }

  return context;
}

export async function createLeadSourceAction(formData: FormData) {
  const { companyId, userProfileId, role, isPlatformOwner } =
    await requireLeadSourceManager();
  const adminClient = createAdminClient();
  const name = normalizeText(formData.get("name"));
  const sheetUrl = normalizeText(formData.get("sheet_url"));
  const rawGid = normalizeText(formData.get("sheet_gid"));

  if (!name || !sheetUrl) {
    redirect("/integracoes/leads?error=required");
  }

  let sheetGid = rawGid;

  try {
    sheetGid = extractGoogleSheetInfo(sheetUrl, rawGid).gid;
  } catch {
    redirect("/integracoes/leads?error=invalid_sheet");
  }

  const payload = {
    company_id: companyId,
    name,
    sheet_url: sheetUrl,
    sheet_gid: sheetGid,
    start_row: parseStartRow(formData.get("start_row")),
    name_column: normalizeColumn(formData.get("name_column"), "A"),
    phone_column: normalizeColumn(formData.get("phone_column"), "B") || null,
    email_column: normalizeColumn(formData.get("email_column")) || null,
    cpf_column: normalizeColumn(formData.get("cpf_column")) || null,
    campaign_column: normalizeColumn(formData.get("campaign_column")) || null,
    notes_column: normalizeColumn(formData.get("notes_column")) || null,
    created_by: userProfileId,
  };

  const { data, error } = await adminClient
    .from("lead_sources")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    const code = error.code === "23505" ? "duplicated" : "save_failed";
    redirect(`/integracoes/leads?error=${code}`);
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "lead_source.created",
    entityType: "lead_source",
    entityId: (data as { id?: string } | null)?.id ?? null,
    entityLabel: name,
    details: {
      role,
      is_platform_owner: isPlatformOwner,
      start_row: payload.start_row,
      columns: {
        name: payload.name_column,
        phone: payload.phone_column,
        email: payload.email_column,
        cpf: payload.cpf_column,
        campaign: payload.campaign_column,
        notes: payload.notes_column,
      },
    },
  });

  revalidatePath("/integracoes/leads");
  redirect("/integracoes/leads?success=created");
}

export async function toggleLeadSourceAction(formData: FormData) {
  const { companyId, userProfileId } = await requireLeadSourceManager();
  const adminClient = createAdminClient();
  const sourceId = normalizeText(formData.get("source_id"));
  const nextActive = normalizeText(formData.get("next_active")) === "true";

  if (!sourceId) {
    redirect("/integracoes/leads?error=missing_source");
  }

  const { error } = await adminClient
    .from("lead_sources")
    .update({
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceId)
    .eq("company_id", companyId);

  if (error) {
    redirect("/integracoes/leads?error=save_failed");
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: nextActive ? "lead_source.activated" : "lead_source.deactivated",
    entityType: "lead_source",
    entityId: sourceId,
  });

  revalidatePath("/integracoes/leads");
  redirect("/integracoes/leads?success=updated");
}

export async function deleteLeadSourceAction(formData: FormData) {
  const { companyId, userProfileId } = await requireLeadSourceManager();
  const adminClient = createAdminClient();
  const sourceId = normalizeText(formData.get("source_id"));

  if (!sourceId) {
    redirect("/integracoes/leads?error=missing_source");
  }

  const { error } = await adminClient
    .from("lead_sources")
    .delete()
    .eq("id", sourceId)
    .eq("company_id", companyId);

  if (error) {
    redirect("/integracoes/leads?error=delete_failed");
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "lead_source.deleted",
    entityType: "lead_source",
    entityId: sourceId,
  });

  revalidatePath("/integracoes/leads");
  revalidatePath("/leads");
  redirect("/integracoes/leads?success=deleted");
}
