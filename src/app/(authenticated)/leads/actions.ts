"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { fetchSheetLeads, onlyDigits, type SheetLeadSource } from "@/lib/leads/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadSourceRecord = SheetLeadSource & {
  name: string;
};

type LeadIdentity = {
  phone: string | null;
  cpf: string | null;
};

function canManageLeadDistribution(role: string | null, isPlatformOwner: boolean) {
  return isPlatformOwner || role === "admin" || role === "manager";
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeIds(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function buildRedirectUrl(params: Record<string, string | number>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value));
  });

  return `/leads?${query.toString()}`;
}

function addIdentityKeys(set: Set<string>, lead: LeadIdentity) {
  if (lead.phone) {
    set.add(`phone:${lead.phone}`);
  }

  if (lead.cpf) {
    set.add(`cpf:${lead.cpf}`);
  }
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

async function requireLeadDistributionManager() {
  const context = await getCurrentUserContext();

  if (!canManageLeadDistribution(context.role, context.isPlatformOwner)) {
    redirect("/areas");
  }

  return context;
}

async function loadCommercialConsultants(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
  companyId: string,
  consultantIds: string[],
) {
  if (!consultantIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email")
    .eq("company_id", companyId)
    .eq("business_area", "commercial")
    .eq("role", "seller")
    .eq("is_active", true)
    .in("id", consultantIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    nickname: string | null;
    username: string | null;
    email: string | null;
  }>;
}

async function loadCompanyLeadIdentitySet(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
  companyId: string,
) {
  const { data, error } = await supabase
    .from("leads")
    .select("phone, cpf")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  const identitySet = new Set<string>();

  for (const row of (data ?? []) as LeadIdentity[]) {
    addIdentityKeys(identitySet, {
      phone: onlyDigits(row.phone),
      cpf: onlyDigits(row.cpf),
    });
  }

  return identitySet;
}

async function loadSourceRowKeys(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
  companyId: string,
  sourceId: string,
) {
  const { data, error } = await supabase
    .from("leads")
    .select("source_row_key")
    .eq("company_id", companyId)
    .eq("source_id", sourceId);

  if (error) {
    throw error;
  }

  return new Set(
    ((data ?? []) as Array<{ source_row_key: string | null }>)
      .map((row) => row.source_row_key)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function verifyLeadSourcesAction() {
  const { companyId, userProfileId } = await requireLeadDistributionManager();
  const adminClient = createAdminClient();
  const { data: sourcesData, error: sourcesError } = await adminClient
    .from("lead_sources")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (sourcesError) {
    redirect(buildRedirectUrl({ error: "source_query_failed" }));
  }

  const sources = (sourcesData ?? []) as LeadSourceRecord[];

  if (!sources.length) {
    redirect(buildRedirectUrl({ error: "no_sources" }));
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const companyIdentitySet = await loadCompanyLeadIdentitySet(adminClient, companyId);

  for (const source of sources) {
    try {
      const [sheetLeads, sourceRowKeys] = await Promise.all([
        fetchSheetLeads(source),
        loadSourceRowKeys(adminClient, companyId, source.id),
      ]);
      const newLeads = [];

      for (const lead of sheetLeads) {
        const phone = onlyDigits(lead.phone);
        const cpf = onlyDigits(lead.cpf);
        const identityKeys = [
          phone ? `phone:${phone}` : null,
          cpf ? `cpf:${cpf}` : null,
        ].filter((value): value is string => Boolean(value));
        const duplicatedIdentity = identityKeys.some((key) =>
          companyIdentitySet.has(key),
        );

        if (sourceRowKeys.has(lead.rowKey) || duplicatedIdentity) {
          skipped += 1;
          continue;
        }

        newLeads.push({
          company_id: companyId,
          source_id: source.id,
          source_row_key: lead.rowKey,
          source_row_number: lead.rowNumber,
          full_name: lead.fullName,
          phone,
          email: lead.email,
          cpf,
          campaign: lead.campaign,
          notes: lead.notes,
          raw_data: lead.rawData,
        });
        sourceRowKeys.add(lead.rowKey);
        addIdentityKeys(companyIdentitySet, { phone, cpf });
      }

      if (newLeads.length) {
        const { error: insertError } = await adminClient.from("leads").insert(newLeads);

        if (insertError) {
          throw insertError;
        }

        imported += newLeads.length;
      }

      await adminClient
        .from("lead_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id)
        .eq("company_id", companyId);
    } catch (error) {
      errors += 1;
      await recordAuditLog({
        supabase: adminClient,
        companyId,
        userProfileId,
        action: "lead_source.import_failed",
        entityType: "lead_source",
        entityId: source.id,
        entityLabel: source.name,
        details: {
          error: error instanceof Error ? error.message : "Erro desconhecido.",
        },
      });
    }
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "leads.imported_from_sheets",
    entityType: "lead",
    details: {
      sources: sources.length,
      imported,
      skipped,
      errors,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/integracoes/leads");
  redirect(buildRedirectUrl({ imported, skipped, errors }));
}

export async function assignSelectedLeadsAction(formData: FormData) {
  const { companyId, userProfileId } = await requireLeadDistributionManager();
  const adminClient = createAdminClient();
  const leadIds = normalizeIds(formData.getAll("lead_id"));
  const consultantId = normalizeText(formData.get("manual_consultant_id"));

  if (!leadIds.length) {
    redirect(buildRedirectUrl({ error: "select_leads" }));
  }

  if (!consultantId) {
    redirect(buildRedirectUrl({ error: "select_consultant" }));
  }

  const consultants = await loadCommercialConsultants(adminClient, companyId, [
    consultantId,
  ]);

  if (consultants.length !== 1) {
    redirect(buildRedirectUrl({ error: "invalid_consultant" }));
  }

  const now = new Date().toISOString();
  const { error } = await adminClient
    .from("leads")
    .update({
      status: "distribuido",
      assigned_to: consultantId,
      assigned_by: userProfileId,
      assigned_at: now,
      updated_at: now,
    })
    .eq("company_id", companyId)
    .in("id", leadIds);

  if (error) {
    redirect(buildRedirectUrl({ error: "assign_failed" }));
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "leads.assigned",
    entityType: "lead",
    details: {
      lead_count: leadIds.length,
      assigned_to: consultantId,
    },
  });

  revalidatePath("/leads");
  redirect(buildRedirectUrl({ assigned: leadIds.length }));
}

export async function autoDistributeLeadsAction(formData: FormData) {
  const { companyId, userProfileId } = await requireLeadDistributionManager();
  const adminClient = createAdminClient();
  const selectedLeadIds = normalizeIds(formData.getAll("lead_id"));
  const consultantIds = normalizeIds(formData.getAll("auto_consultant_id"));

  if (!consultantIds.length) {
    redirect(buildRedirectUrl({ error: "select_consultants" }));
  }

  const consultants = await loadCommercialConsultants(
    adminClient,
    companyId,
    consultantIds,
  );

  if (consultants.length !== consultantIds.length) {
    redirect(buildRedirectUrl({ error: "invalid_consultant" }));
  }

  let query = adminClient
    .from("leads")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "novo")
    .order("imported_at", { ascending: true });

  if (selectedLeadIds.length) {
    query = query.in("id", selectedLeadIds);
  }

  const { data: leadData, error: leadError } = await query;

  if (leadError) {
    redirect(buildRedirectUrl({ error: "lead_query_failed" }));
  }

  const leadIds = ((leadData ?? []) as Array<{ id: string }>).map((lead) => lead.id);

  if (!leadIds.length) {
    redirect(buildRedirectUrl({ error: "no_new_leads" }));
  }

  const randomizedLeads = shuffleItems(leadIds);
  const randomizedConsultants = shuffleItems(consultants);
  const now = new Date().toISOString();
  let assigned = 0;

  for (const [index, consultant] of randomizedConsultants.entries()) {
    const consultantLeadIds = randomizedLeads.filter(
      (_leadId, leadIndex) => leadIndex % randomizedConsultants.length === index,
    );

    if (!consultantLeadIds.length) {
      continue;
    }

    const { error } = await adminClient
      .from("leads")
      .update({
        status: "distribuido",
        assigned_to: consultant.id,
        assigned_by: userProfileId,
        assigned_at: now,
        updated_at: now,
      })
      .eq("company_id", companyId)
      .in("id", consultantLeadIds);

    if (error) {
      redirect(buildRedirectUrl({ error: "assign_failed" }));
    }

    assigned += consultantLeadIds.length;
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "leads.auto_distributed",
    entityType: "lead",
    details: {
      lead_count: assigned,
      consultant_count: randomizedConsultants.length,
      selected_only: selectedLeadIds.length > 0,
    },
  });

  revalidatePath("/leads");
  redirect(buildRedirectUrl({ auto_assigned: assigned }));
}
