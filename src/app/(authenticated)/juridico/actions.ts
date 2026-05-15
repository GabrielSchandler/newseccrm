"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import {
  getLegalWorkflowStage,
  normalizeLegalWorkflowStage,
  type LegalWorkflowStage,
} from "@/lib/legal/workflow";
import { assertPreSaleAccess } from "@/lib/pre-sales/access";
import type { PreSaleStatus } from "@/types/pre-sale";

export type JuridicoActionState = {
  ok: boolean;
  message: string;
};

function friendlyError(message: string): JuridicoActionState {
  return {
    ok: false,
    message,
  };
}

function canUseLegalWorkflow(role: string | null, businessArea: string) {
  return role === "admin" || role === "manager" || (role === "seller" && businessArea === "legal");
}

type LegalArchiveStatus = Extract<PreSaleStatus, "aprovado" | "inativo" | "distrato">;

const legalArchiveStatusLabels: Record<LegalArchiveStatus, string> = {
  aprovado: "Ativo na esteira",
  inativo: "Inativo",
  distrato: "Distrato",
};

export async function updateLegalWorkflowStageAction(
  preSaleId: string,
  stage: LegalWorkflowStage,
  changeNote?: string | null,
): Promise<JuridicoActionState> {
  const normalizedChangeNote = changeNote?.trim();

  if (!normalizedChangeNote) {
    return friendlyError("Descreva a movimentacao juridica e o motivo.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();

    if (!canUseLegalWorkflow(role, businessArea)) {
      return friendlyError("O usuario atual nao pode movimentar a esteira juridica.");
    }

    const preSale = await assertPreSaleAccess(preSaleId);
    const normalizedStage = normalizeLegalWorkflowStage(stage);
    const stageMeta = getLegalWorkflowStage(normalizedStage);
    const { data: currentStageData, error: currentStageError } = await supabase
      .from("pre_sales")
      .select("legal_stage")
      .eq("id", preSale.id)
      .eq("company_id", companyId)
      .single();

    if (currentStageError || !currentStageData) {
      return friendlyError("Pre-venda nao encontrada para atualizar a etapa juridica.");
    }

    const { error } = await supabase
      .from("pre_sales")
      .update({
        legal_stage: normalizedStage,
        legal_stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", preSale.id)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.stage_updated",
      entityType: "pre_sale",
      entityId: preSale.id,
      entityLabel: preSale.id,
      details: {
        legal_stage: normalizedStage,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId: preSale.client_id,
      preSaleId: preSale.id,
      eventType: "legal_stage_updated",
      title: `Esteira juridica movida para ${stageMeta.shortLabel}`,
      note: normalizedChangeNote,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        previous_stage: (currentStageData as { legal_stage: string | null }).legal_stage,
        next_stage: normalizedStage,
      },
    });

    revalidatePath("/juridico");
    revalidatePath(`/pre-vendas/${preSale.id}`);
    revalidatePath("/documentos");

    return {
      ok: true,
      message: `Cliente movido para ${stageMeta.shortLabel}.`,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar a etapa juridica.",
    );
  }
}

export async function updateLegalArchiveStatusAction(
  preSaleId: string,
  status: LegalArchiveStatus,
  changeNote?: string | null,
): Promise<JuridicoActionState> {
  const normalizedChangeNote = changeNote?.trim();

  if (!normalizedChangeNote) {
    return friendlyError("Descreva o motivo dessa mudanca de situacao juridica.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();

    if (!canUseLegalWorkflow(role, businessArea)) {
      return friendlyError("O usuario atual nao pode alterar a situacao juridica.");
    }

    const preSale = await assertPreSaleAccess(preSaleId);
    const { data: currentPreSaleData, error: currentPreSaleError } = await supabase
      .from("pre_sales")
      .select("status")
      .eq("id", preSale.id)
      .eq("company_id", companyId)
      .single();

    if (currentPreSaleError || !currentPreSaleData) {
      return friendlyError("Pre-venda nao encontrada para alterar a situacao juridica.");
    }

    const { error } = await supabase
      .from("pre_sales")
      .update({
        status,
        legal_stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", preSale.id)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.archive_status_updated",
      entityType: "pre_sale",
      entityId: preSale.id,
      entityLabel: preSale.id,
      details: {
        status,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId: preSale.client_id,
      preSaleId: preSale.id,
      eventType: "pre_sale_status_updated",
      title: `Situacao juridica alterada para ${legalArchiveStatusLabels[status]}`,
      note: normalizedChangeNote,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        previous_status: (currentPreSaleData as { status: string | null }).status,
        next_status: status,
      },
    });

    revalidatePath("/juridico");
    revalidatePath(`/pre-vendas/${preSale.id}`);
    revalidatePath(`/clientes/${preSale.client_id}`);

    return {
      ok: true,
      message: `Situacao juridica alterada para ${legalArchiveStatusLabels[status]}.`,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel alterar a situacao juridica.",
    );
  }
}
