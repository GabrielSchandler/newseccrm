"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { getValidMicrosoftAccessToken, markMicrosoftIntegrationUsed } from "@/lib/email/integrations";
import { dispatchMicrosoftEmail, type MicrosoftAttachment } from "@/lib/email/microsoft";
import { buildSignedEmailHtml } from "@/lib/email/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientDocumentsBucket } from "@/lib/client-documents/service";
import type { Client } from "@/types/client";
import type { ClientDocument } from "@/types/client-document";
import type { EmailDispatchMode, EmailLogStatus, EmailTemplate } from "@/types/email";
import type { PreSale, PreSaleFinancialCase } from "@/types/pre-sale";
import type { CompanyUserProfile } from "@/types/user";

export type EmailActionState = {
  ok: boolean;
  message: string;
};

const sendClientEmailSchema = z.object({
  client_id: z.string().uuid(),
  pre_sale_id: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
  template_id: z.string().uuid(),
  mode: z.enum(["draft", "send"]),
  to: z.string().trim(),
  cc: z.string().trim().optional().default(""),
  bcc: z.string().trim().optional().default(""),
  attachment_ids: z.array(z.string().uuid()).default([]),
});

export type SendClientEmailPayload = z.input<typeof sendClientEmailSchema>;

const maxSimpleGraphAttachmentBytes = 3 * 1024 * 1024;

function friendlyError(message: string): EmailActionState {
  return {
    ok: false,
    message,
  };
}

function parseEmailList(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[;,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function renderTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    return variables[key] ?? "Nao informado";
  });
}

function currency(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Nao informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}

function buildVariables(
  client: Client,
  preSale: PreSale | null,
  financialCase: PreSaleFinancialCase | null,
) {
  return {
    nome_cliente: client.full_name || "Nao informado",
    cpf: client.cpf || "Nao informado",
    email_cliente: client.email || "Nao informado",
    telefone_cliente: client.phone_mobile || "Nao informado",
    banco: financialCase?.financer_name || "Nao informado",
    financeira: financialCase?.financer_name || "Nao informado",
    financeira_razao_social: financialCase?.financer_legal_name || "Nao informado",
    financeira_cnpj: financialCase?.financer_cnpj || "Nao informado",
    numero_contrato: financialCase?.contract_number || "Nao informado",
    valor_contrato: currency(preSale?.contract_value),
  };
}

async function getClientDocumentAttachments(
  companyId: string,
  clientId: string,
  attachmentIds: string[],
) {
  if (!attachmentIds.length) {
    return {
      graphAttachments: [] as MicrosoftAttachment[],
      logAttachments: [] as Array<Record<string, unknown>>,
    };
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("client_documents")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .in("id", attachmentIds);

  if (error) {
    throw new Error(error.message);
  }

  const documents = (data ?? []) as ClientDocument[];
  const missingIds = attachmentIds.filter(
    (id) => !documents.some((document) => document.id === id),
  );

  if (missingIds.length) {
    throw new Error("Um ou mais anexos selecionados nao pertencem a este cliente.");
  }

  const totalSize = documents.reduce((sum, document) => sum + Number(document.file_size ?? 0), 0);

  if (totalSize > maxSimpleGraphAttachmentBytes) {
    throw new Error(
      "Os anexos selecionados ultrapassam 3 MB. Nesta primeira versao, selecione arquivos menores ou envie sem anexos grandes.",
    );
  }

  const graphAttachments: MicrosoftAttachment[] = [];

  for (const document of documents) {
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(clientDocumentsBucket)
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message || `Nao foi possivel anexar ${document.file_name}.`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    graphAttachments.push({
      name: document.file_name,
      contentType: document.mime_type || "application/octet-stream",
      contentBytes: buffer.toString("base64"),
    });
  }

  return {
    graphAttachments,
    logAttachments: documents.map((document) => ({
      id: document.id,
      title: document.title,
      file_name: document.file_name,
      file_size: document.file_size,
      document_type: document.document_type,
    })),
  };
}

export async function sendClientEmailAction(
  values: SendClientEmailPayload,
): Promise<EmailActionState> {
  const parsed = sendClientEmailSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos do email.");
  }

  const to = parseEmailList(parsed.data.to);
  const cc = parseEmailList(parsed.data.cc);
  const bcc = parseEmailList(parsed.data.bcc);

  if (!to.length) {
    return friendlyError("Informe pelo menos um destinatario em Para.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const [{ data: clientData }, { data: templateData }, { data: preSaleData }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("id", parsed.data.client_id)
          .eq("company_id", companyId)
          .single(),
        supabase
          .from("email_templates")
          .select("*")
          .eq("id", parsed.data.template_id)
          .eq("company_id", companyId)
          .eq("is_active", true)
          .single(),
        parsed.data.pre_sale_id
          ? supabase
              .from("pre_sales")
              .select("*")
              .eq("id", parsed.data.pre_sale_id)
              .eq("company_id", companyId)
              .single()
          : Promise.resolve({ data: null }),
      ]);
    const client = clientData as Client | null;
    const template = templateData as EmailTemplate | null;
    const preSale = preSaleData as PreSale | null;

    if (!client) {
      return friendlyError("Cliente nao encontrado.");
    }

    if (!template) {
      return friendlyError("Template de email nao encontrado ou inativo.");
    }

    if (parsed.data.pre_sale_id && !preSale) {
      return friendlyError("Pre-venda nao encontrada.");
    }

    if (!client.legal_responsible_user_id) {
      return friendlyError("Defina um Adm responsavel no cliente antes de enviar email.");
    }

    const { data: financialCaseData } = preSale
      ? await supabase
          .from("pre_sale_financial_cases")
          .select("*")
          .eq("pre_sale_id", preSale.id)
          .maybeSingle()
      : { data: null };
    const financialCase = financialCaseData as PreSaleFinancialCase | null;
    const { accessToken, integration } = await getValidMicrosoftAccessToken(
      companyId,
      client.legal_responsible_user_id,
    );
    const { data: senderProfileData } = await supabase
      .from("user_profiles")
      .select("id, full_name, nickname, email, phone, role, legal_role")
      .eq("id", client.legal_responsible_user_id)
      .eq("company_id", companyId)
      .maybeSingle();
    const senderProfile = senderProfileData as CompanyUserProfile | null;
    const variables = buildVariables(client, preSale, financialCase);
    const subject = renderTemplate(template.subject_template, variables);
    const body = buildSignedEmailHtml(renderTemplate(template.body_template, variables), {
      sender: senderProfile,
      senderEmail: integration.email,
      senderDisplayName: integration.display_name,
    });
    const { graphAttachments, logAttachments } = await getClientDocumentAttachments(
      companyId,
      client.id,
      parsed.data.attachment_ids,
    );
    let dispatchStatus: EmailLogStatus;
    let microsoftMessageId: string | null = null;

    try {
      const result = await dispatchMicrosoftEmail({
        mode: parsed.data.mode as EmailDispatchMode,
        accessToken,
        subject,
        body,
        to,
        cc,
        bcc,
        attachments: graphAttachments,
      });
      dispatchStatus = result.status;
      microsoftMessageId = result.messageId;
    } catch (dispatchError) {
      await supabase.from("email_logs").insert({
        company_id: companyId,
        client_id: client.id,
        pre_sale_id: preSale?.id ?? null,
        template_id: template.id,
        legal_stage: preSale?.legal_stage ?? null,
        sender_user_profile_id: client.legal_responsible_user_id,
        action_by_user_profile_id: userProfileId,
        sender_email: integration.email,
        mode: parsed.data.mode,
        status: "error",
        subject,
        body,
        recipients: { to, cc, bcc },
        attachments: logAttachments,
        error_message:
          dispatchError instanceof Error
            ? dispatchError.message
            : "Falha ao enviar email pelo Outlook.",
      });

      throw dispatchError;
    }

    await supabase.from("email_logs").insert({
      company_id: companyId,
      client_id: client.id,
      pre_sale_id: preSale?.id ?? null,
      template_id: template.id,
      legal_stage: preSale?.legal_stage ?? null,
      sender_user_profile_id: client.legal_responsible_user_id,
      action_by_user_profile_id: userProfileId,
      sender_email: integration.email,
      mode: parsed.data.mode,
      status: dispatchStatus,
      subject,
      body,
      recipients: { to, cc, bcc },
      attachments: logAttachments,
      microsoft_message_id: microsoftMessageId,
    });

    await markMicrosoftIntegrationUsed(companyId, integration.id);

    await recordClientTimelineEvent({
      companyId,
      clientId: client.id,
      preSaleId: preSale?.id ?? null,
      eventType: parsed.data.mode === "draft" ? "email_draft_created" : "email_sent",
      title:
        parsed.data.mode === "draft"
          ? "Rascunho de email criado no Outlook"
          : "Email enviado pelo Outlook",
      note: `${template.name} | Para: ${to.join(", ")} | Anexos: ${
        logAttachments.length ? logAttachments.map((item) => item.file_name).join(", ") : "nenhum"
      }`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        template_id: template.id,
        template_name: template.name,
        sender_email: integration.email,
        recipients: { to, cc, bcc },
        attachments: logAttachments,
      },
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: parsed.data.mode === "draft" ? "email.draft_created" : "email.sent",
      entityType: "email",
      entityId: client.id,
      entityLabel: subject,
      details: {
        client_id: client.id,
        pre_sale_id: preSale?.id ?? null,
        template_id: template.id,
        sender_email: integration.email,
        to,
      },
    });

    revalidatePath(`/clientes/${client.id}`);

    if (preSale?.id) {
      revalidatePath(`/pre-vendas/${preSale.id}`);
      revalidatePath("/juridico");
    }

    return {
      ok: true,
      message:
        parsed.data.mode === "draft"
          ? "Rascunho criado no Outlook do Adm responsavel."
          : "Email enviado pelo Outlook do Adm responsavel.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel processar o email.",
    );
  }
}
