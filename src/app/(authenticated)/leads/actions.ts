"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  fetchSheetLeads,
  normalizeBrazilianPhone,
  normalizeCpf,
  type SheetLeadSource,
} from "@/lib/leads/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadSourceRecord = SheetLeadSource & {
  name: string;
};

type LeadIdentity = {
  phone: string | null;
  cpf: string | null;
};

type LeadToAssign = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  campaign: string | null;
  notes: string | null;
  raw_data: Record<string, unknown> | null;
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

function buildRedirectUrl(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

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

function getLeadClientId(lead: Pick<LeadToAssign, "raw_data">) {
  const value = lead.raw_data?.crm_client_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildLeadClientNotes(lead: Pick<LeadToAssign, "campaign" | "notes">) {
  return [
    "Cliente criado automaticamente pela distribuicao de leads.",
    lead.campaign ? `Origem/campanha: ${lead.campaign}` : null,
    lead.notes ? `Observacao da planilha: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInternalLeadCpf(leadId: string) {
  const letterMap: Record<string, string> = {
    "0": "A",
    "1": "B",
    "2": "C",
    "3": "D",
    "4": "E",
    "5": "F",
    "6": "G",
    "7": "H",
    "8": "I",
    "9": "J",
    a: "K",
    b: "L",
    c: "M",
    d: "N",
    e: "O",
    f: "P",
  };
  const encoded = leadId
    .replace(/[^a-f0-9]/gi, "")
    .toLowerCase()
    .split("")
    .map((char) => letterMap[char] ?? "")
    .join("")
    .slice(0, 24);

  return `LEAD-${encoded || "SEMCPF"}`;
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
      phone: normalizeBrazilianPhone(row.phone),
      cpf: normalizeCpf(row.cpf),
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

async function findExistingClientForLead(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  lead: Pick<LeadToAssign, "cpf" | "phone" | "email">,
) {
  const cpf = normalizeCpf(lead.cpf);
  const phone = normalizeBrazilianPhone(lead.phone);
  const email = lead.email?.trim().toLowerCase() ?? null;
  const filters = [];

  if (cpf) {
    filters.push(`cpf.eq.${cpf}`, `cpf.eq.${cpf.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4",
    )}`);
  }

  if (phone) {
    filters.push(`phone_mobile.eq.${phone}`);

    if (phone.length === 10 || phone.length === 11) {
      filters.push(`phone_mobile.eq.55${phone}`);
    }
  }

  if (email) {
    filters.push(`email.ilike.${email}`);
  }

  if (!filters.length) {
    return null;
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or(filters.join(","))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function ensureClientForLead({
  supabase,
  companyId,
  userProfileId,
  consultantId,
  lead,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  companyId: string;
  userProfileId: string;
  consultantId: string;
  lead: LeadToAssign;
}) {
  const existingClientId = getLeadClientId(lead);

  if (existingClientId) {
    return existingClientId;
  }

  const matchedClientId = await findExistingClientForLead(supabase, companyId, lead);

  if (matchedClientId) {
    await supabase
      .from("clients")
      .update({
        commercial_consultant_user_id: consultantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchedClientId)
      .eq("company_id", companyId);

    return matchedClientId;
  }

  const placeholderCpf = buildInternalLeadCpf(lead.id);
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: companyId,
      full_name: lead.full_name,
      cpf: normalizeCpf(lead.cpf) ?? placeholderCpf,
      rg: null,
      nationality: null,
      birth_date: null,
      marital_status: null,
      profession: null,
      email: lead.email,
      phone_mobile: normalizeBrazilianPhone(lead.phone) ?? "",
      phone_secondary: null,
      zip_code: null,
      street: null,
      number: null,
      district: null,
      city: null,
      state: null,
      notes: buildLeadClientNotes(lead),
      commercial_consultant_user_id: consultantId,
      created_by: userProfileId,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

async function assignLeadsToConsultant({
  supabase,
  companyId,
  userProfileId,
  leadIds,
  consultantId,
  assignedAt,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  companyId: string;
  userProfileId: string;
  leadIds: string[];
  consultantId: string;
  assignedAt: string;
}) {
  if (!leadIds.length) {
    return 0;
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, phone, email, cpf, campaign, notes, raw_data")
    .eq("company_id", companyId)
    .in("id", leadIds);

  if (error) {
    throw error;
  }

  const leads = (data ?? []) as LeadToAssign[];
  let assigned = 0;

  for (const lead of leads) {
    const clientId = await ensureClientForLead({
      supabase,
      companyId,
      userProfileId,
      consultantId,
      lead,
    });
    const nextRawData = {
      ...(lead.raw_data ?? {}),
      crm_client_id: clientId,
      distributed_to_client_at: assignedAt,
    };
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: "distribuido",
        assigned_to: consultantId,
        assigned_by: userProfileId,
        assigned_at: assignedAt,
        updated_at: assignedAt,
        raw_data: nextRawData,
      })
      .eq("company_id", companyId)
      .eq("id", lead.id);

    if (updateError) {
      throw updateError;
    }

    assigned += 1;
  }

  return assigned;
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
  const errorMessages: string[] = [];
  const companyIdentitySet = await loadCompanyLeadIdentitySet(adminClient, companyId);

  for (const source of sources) {
    try {
      const [sheetLeads, sourceRowKeys] = await Promise.all([
        fetchSheetLeads(source),
        loadSourceRowKeys(adminClient, companyId, source.id),
      ]);
      const newLeads = [];

      for (const lead of sheetLeads) {
        const phone = normalizeBrazilianPhone(lead.phone);
        const cpf = normalizeCpf(lead.cpf);
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
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
      errorMessages.push(`${source.name}: ${errorMessage}`);
      await recordAuditLog({
        supabase: adminClient,
        companyId,
        userProfileId,
        action: "lead_source.import_failed",
        entityType: "lead_source",
        entityId: source.id,
        entityLabel: source.name,
        details: {
          error: errorMessage,
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
  redirect(
    buildRedirectUrl({
      imported,
      skipped,
      errors,
      error_message: errorMessages[0],
    }),
  );
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
  let assigned = 0;

  try {
    assigned = await assignLeadsToConsultant({
      supabase: adminClient,
      companyId,
      userProfileId,
      leadIds,
      consultantId,
      assignedAt: now,
    });
  } catch {
    redirect(buildRedirectUrl({ error: "assign_failed" }));
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "leads.assigned",
    entityType: "lead",
    details: {
      lead_count: assigned,
      assigned_to: consultantId,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/clientes");
  redirect(buildRedirectUrl({ assigned }));
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

    try {
      const consultantAssigned = await assignLeadsToConsultant({
        supabase: adminClient,
        companyId,
        userProfileId,
        leadIds: consultantLeadIds,
        consultantId: consultant.id,
        assignedAt: now,
      });

      assigned += consultantAssigned;
    } catch {
      redirect(buildRedirectUrl({ error: "assign_failed" }));
    }
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
  revalidatePath("/clientes");
  redirect(buildRedirectUrl({ auto_assigned: assigned }));
}

export async function syncDistributedLeadClientsAction() {
  const { companyId, userProfileId } = await requireLeadDistributionManager();
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("leads")
    .select("id, full_name, phone, email, cpf, campaign, notes, raw_data, assigned_to")
    .eq("company_id", companyId)
    .eq("status", "distribuido")
    .not("assigned_to", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(500);

  if (error) {
    redirect(buildRedirectUrl({ error: "lead_query_failed" }));
  }

  const leads = ((data ?? []) as Array<LeadToAssign & { assigned_to: string | null }>)
    .filter((lead) => lead.assigned_to && !getLeadClientId(lead));
  const now = new Date().toISOString();
  let synced = 0;

  try {
    for (const lead of leads) {
      const consultantId = lead.assigned_to;

      if (!consultantId) {
        continue;
      }

      const clientId = await ensureClientForLead({
        supabase: adminClient,
        companyId,
        userProfileId,
        consultantId,
        lead,
      });
      const { error: updateError } = await adminClient
        .from("leads")
        .update({
          raw_data: {
            ...(lead.raw_data ?? {}),
            crm_client_id: clientId,
            distributed_to_client_at: now,
            synced_existing_distribution_at: now,
          },
          updated_at: now,
        })
        .eq("company_id", companyId)
        .eq("id", lead.id);

      if (updateError) {
        throw updateError;
      }

      synced += 1;
    }
  } catch {
    redirect(buildRedirectUrl({ error: "sync_clients_failed" }));
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: "leads.distributed_clients_synced",
    entityType: "lead",
    details: {
      lead_count: synced,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/clientes");
  redirect(buildRedirectUrl({ synced_clients: synced }));
}
