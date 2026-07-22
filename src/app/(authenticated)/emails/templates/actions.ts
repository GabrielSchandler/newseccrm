"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { emailTemplateSchema } from "@/lib/email/schema";
import { createAdminClient } from "@/lib/supabase/admin";

function canManageEmailTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function redirectWithTemplateError(message: string): never {
  redirect(`/emails/templates?error=${encodeURIComponent(message)}`);
}

function normalizeTemplateSaveError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("email_templates") &&
    (lowerMessage.includes("does not exist") || lowerMessage.includes("not found"))
  ) {
    return "A tabela de templates de email ainda não existe no Supabase. Rode o SQL docs/sql/email-outlook-juridico.sql.";
  }

  if (lowerMessage.includes("row-level security")) {
    return "O Supabase bloqueou o cadastro por política de segurança. Confirme se seu usuário está como admin/gerente e se o SQL de email foi rodado completo.";
  }

  if (lowerMessage.includes("permission denied")) {
    return "O usuário atual não tem permissão para salvar templates de email.";
  }

  if (lowerMessage.includes("column") && lowerMessage.includes("does not exist")) {
    return "A tabela de templates de email está desatualizada. Rode novamente o SQL docs/sql/email-outlook-juridico.sql.";
  }

  return message || "Não foi possível salvar o template de email.";
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

async function resolveEmailTemplateStage(
  selectedStage: string | null | undefined,
  companyId: string,
) {
  if (!selectedStage) {
    return {
      legal_stage: null,
      legal_stage_id: null,
    };
  }

  const adminClient = createAdminClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      selectedStage,
    );

  if (!isUuid) {
    return {
      legal_stage: selectedStage,
      legal_stage_id: null,
    };
  }

  const { data, error } = await adminClient
    .from("legal_workflow_stages")
    .select("id, legacy_key")
    .eq("id", selectedStage)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw new Error("A etapa jurídica selecionada não foi encontrada.");
  }

  return {
    legal_stage: data.legacy_key,
    legal_stage_id: data.id,
  };
}

export async function createEmailTemplateAction(formData: FormData) {
  const parsed = emailTemplateSchema.safeParse(formDataToTemplatePayload(formData));

  if (!parsed.success) {
    redirectWithTemplateError("Preencha nome, assunto e corpo do email.");
  }

  const { companyId, userProfileId, role } = await getCurrentUserContext();

  if (!canManageEmailTemplates(role)) {
    redirect("/emails/templates?error=permission");
  }

  const adminClient = createAdminClient();
  const stagePayload = await resolveEmailTemplateStage(
    parsed.data.legal_stage,
    companyId,
  );
  const { data, error } = await adminClient
    .from("email_templates")
    .insert({
      company_id: companyId,
      business_area: "legal",
      created_by: userProfileId,
      ...parsed.data,
      ...stagePayload,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[email-template] create failed", error);
    redirectWithTemplateError(normalizeTemplateSaveError(error.message));
  }

  await recordAuditLog({
    supabase: adminClient,
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
  const { companyId, userProfileId, role } = await getCurrentUserContext();

  if (!canManageEmailTemplates(role)) {
    redirect("/emails/templates?error=permission");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("email_templates")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("company_id", companyId);

  if (error) {
    redirectWithTemplateError(normalizeTemplateSaveError(error.message));
  }

  await recordAuditLog({
    supabase: adminClient,
    companyId,
    userProfileId,
    action: isActive ? "email_template.activated" : "email_template.deactivated",
    entityType: "email_template",
    entityId: templateId,
  });

  revalidatePath("/emails/templates");
}
