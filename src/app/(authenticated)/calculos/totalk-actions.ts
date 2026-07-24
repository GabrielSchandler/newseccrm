"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { findTotalkContactByPhone, sendTotalkDocument } from "@/lib/totalk/api";
import {
  getActiveTotalkIntegration,
  markTotalkImportUsed,
  markTotalkSent,
} from "@/lib/totalk/integrations";
import { parseTotalkCalculationAnnotation } from "@/lib/totalk/parser";
import type { ParsedTotalkCalculationData } from "@/lib/totalk/parser";
import {
  assertCalculationAccess,
  calculationReportsBucket,
  canManageCalculations,
} from "@/lib/calculations/service";

export type TotalkImportCalculationActionState = {
  ok: boolean;
  message: string;
  fields?: ParsedTotalkCalculationData["fields"];
  summary?: ParsedTotalkCalculationData["summary"];
  missingFields?: string[];
  warnings?: string[];
  contactName?: string | null;
};

export type TotalkSendAnalysisActionState = {
  ok: boolean;
  message: string;
};

function friendlyTotalkError(message: string) {
  if (message.toLowerCase().includes("unauthorized") || message.includes("HTTP 401")) {
    return "A Totalk recusou o token configurado. Revise o token em Integrações.";
  }

  if (message.includes("HTTP 404")) {
    return "Nenhum contato Totalk foi encontrado para este telefone.";
  }

  if (message.includes("HTTP 429")) {
    return "A Totalk limitou as requisições por alguns instantes. Aguarde e tente novamente.";
  }

  return message;
}

function renderTotalkMessage(
  template: string | null | undefined,
  calculation: {
    client_name?: string | null;
    protocol_number?: string | null;
  },
) {
  const baseTemplate =
    template?.trim() ||
    "Olá, {{nome_cliente}}! Segue sua análise de correção de juros. Protocolo: {{protocolo}}. Qualquer dúvida, nossa equipe está à disposição.";

  return baseTemplate
    .replaceAll("{{nome_cliente}}", calculation.client_name?.trim() || "cliente")
    .replaceAll("{{protocolo}}", calculation.protocol_number?.trim() || "não informado");
}

export async function importTotalkCalculationDataAction(
  phone: string,
): Promise<TotalkImportCalculationActionState> {
  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return {
        ok: false,
        message: "Você não tem permissão para importar dados de simulação.",
      };
    }

    if (!phone.trim()) {
      return {
        ok: false,
        message: "Informe o telefone do cliente para buscar na Totalk.",
      };
    }

    const integration = await getActiveTotalkIntegration(companyId);
    const contact = await findTotalkContactByPhone(integration, phone);

    if (!contact.annotation?.trim()) {
      return {
        ok: false,
        message:
          "Contato encontrado na Totalk, mas sem anotação interna para preencher a simulação.",
      };
    }

    const parsed = parseTotalkCalculationAnnotation(contact.annotation, contact.phone);

    await markTotalkImportUsed(companyId);
    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "totalk.calculation_data_imported",
      entityType: "integration",
      entityId: integration.id,
      entityLabel: contact.contactName ?? contact.phone,
      details: {
        phone: contact.phone,
        contact_name: contact.contactName,
        missing_fields: parsed.missingFields,
      },
    });

    return {
      ok: true,
      message: parsed.missingFields.length
        ? "Dados importados. Revise os campos pendentes antes de salvar."
        : "Dados importados com sucesso. Revise e salve a simulação.",
      fields: parsed.fields,
      summary: parsed.summary,
      missingFields: parsed.missingFields,
      warnings: parsed.warnings,
      contactName: contact.contactName,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? friendlyTotalkError(error.message)
          : "Não foi possível importar os dados da Totalk.",
    };
  }
}

export async function sendCalculationAnalysisViaTotalkAction(
  calculationId: string,
): Promise<TotalkSendAnalysisActionState> {
  try {
    const {
      supabase,
      companyId,
      userProfileId,
      role,
      businessArea,
      fullName,
      nickname,
      username,
      email,
    } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return {
        ok: false,
        message: "Você não tem permissão para enviar análises.",
      };
    }

    const calculation = await assertCalculationAccess(calculationId);

    if (!calculation.pdf_storage_path) {
      return {
        ok: false,
        message: "Gere o PDF antes de enviar a análise.",
      };
    }

    if (!calculation.client_phone) {
      return {
        ok: false,
        message: "A simulação não possui telefone do cliente para envio.",
      };
    }

    const integration = await getActiveTotalkIntegration(companyId);
    const adminClient = createAdminClient();
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from(calculationReportsBucket)
      .createSignedUrl(calculation.pdf_storage_path, 60 * 60, {
        download: calculation.pdf_file_name ?? "simulacao-analise-de-correcao-de-juros.pdf",
      });

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return {
        ok: false,
        message:
          signedUrlError?.message || "Não foi possível liberar o link seguro do PDF.",
      };
    }

    const message = renderTotalkMessage(integration.defaultSendMessage, calculation);
    const result = await sendTotalkDocument({
      integration,
      toPhone: calculation.client_phone,
      fileUrl: signedUrlData.signedUrl,
      text: message,
      senderId: calculationId,
    });

    await markTotalkSent(companyId);
    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "totalk.calculation_pdf_sent",
      entityType: "calculation",
      entityId: calculationId,
      entityLabel: calculation.client_name,
      details: {
        client_id: calculation.client_id,
        pre_sale_id: calculation.pre_sale_id,
        protocol_number: calculation.protocol_number,
        totalk_response: result,
      },
    });

    if (calculation.client_id) {
      await recordClientTimelineEvent({
        companyId,
        clientId: calculation.client_id,
        preSaleId: calculation.pre_sale_id,
        eventType: "calculation_pdf_sent_totalk",
        title: "Análise enviada pelo Totalk",
        note: `PDF da simulação enviado para ${calculation.client_phone}.`,
        actorUserProfileId: userProfileId,
        actorRole: role,
        actorBusinessArea: businessArea,
        actor: {
          full_name: fullName,
          nickname,
          username,
          email,
        },
        details: {
          calculation_id: calculationId,
          protocol_number: calculation.protocol_number,
        },
      });
    }

    revalidatePath(`/calculos/${calculationId}`);

    if (calculation.client_id) {
      revalidatePath(`/clientes/${calculation.client_id}`);
    }

    return {
      ok: true,
      message: "Análise enviada pelo Totalk com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? friendlyTotalkError(error.message)
          : "Não foi possível enviar a análise pelo Totalk.",
    };
  }
}
