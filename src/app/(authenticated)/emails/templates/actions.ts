"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { emailTemplateSchema } from "@/lib/email/schema";

function canManageEmailTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function formDataToTemplatePayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    legal_stage: String(formData.get("legal_stage") ?? ""),
    recipient_mode: String(formData.get("recipient_mode") ?? "client"),
    subject_template: String(formData.get("subject_template") ?? ""),
    body_template: String(formData.get("body_template") ?? ""),
    cc_template: String(formData.get("cc_template") ?? ""),
    bcc_template: String(formData.get("bcc_template") ?? ""),
  };
}

export async function createEmailTemplateAction(formData: FormData) {
  const parsed = emailTemplateSchema.safeParse(formDataToTemplatePayload(formData));

  if (!parsed.success) {
    redirect("/emails/templates?error=invalid");
  }

  const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

  if (!canManageEmailTemplates(role)) {
    redirect("/emails/templates?error=permission");
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      company_id: companyId,
      business_area: "legal",
      created_by: userProfileId,
      ...parsed.data,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/emails/templates?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuditLog({
    supabase,
    companyId,
    userProfileId,
    action: "email_template.created",
    entityType: "email_template",
    entityId: data?.id ?? null,
    entityLabel: parsed.data.name,
  });

  revalidatePath("/emails/templates");
  redirect("/emails/templates?success=created");
}

export async function toggleEmailTemplateStatusAction(templateId: string, isActive: boolean) {
  const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

  if (!canManageEmailTemplates(role)) {
    redirect("/emails/templates?error=permission");
  }

  const { error } = await supabase
    .from("email_templates")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("company_id", companyId);

  if (error) {
    redirect(`/emails/templates?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuditLog({
    supabase,
    companyId,
    userProfileId,
    action: isActive ? "email_template.activated" : "email_template.deactivated",
    entityType: "email_template",
    entityId: templateId,
  });

  revalidatePath("/emails/templates");
}
