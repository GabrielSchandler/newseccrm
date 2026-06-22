"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import {
  getLegalWorkflowStage,
  legalWorkflowStages,
  type LegalWorkflowStageDefinition,
} from "@/lib/legal/workflow";
import { assertPreSaleAccess } from "@/lib/pre-sales/access";
import { createAdminClient } from "@/lib/supabase/admin";

export type LegalWorkflowActionState = {
  ok: boolean;
  message: string;
  batchId?: string;
  undoExpiresAt?: string;
};

const stageSchema = z.object({
  title: z.string().trim().min(3, "Informe um titulo com pelo menos 3 caracteres.").max(100),
  shortTitle: z.string().trim().min(2, "Informe o nome curto da coluna.").max(45),
  description: z.string().trim().min(5, "Informe uma descricao da etapa.").max(500),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Selecione uma cor valida."),
  expectedDocuments: z.array(z.string().trim().min(1).max(150)).max(30),
});

export type LegalWorkflowStagePayload = z.input<typeof stageSchema>;

type StageRow = {
  id: string;
  legacy_key: string | null;
  title: string;
  short_title: string;
  description: string;
  color: string;
  expected_documents: string[];
  position: number;
};

function friendlyError(message: string): LegalWorkflowActionState {
  return { ok: false, message };
}

function isMissingWorkflowSchema(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("legal_workflow_stages") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find"))
  );
}

function canEditWorkflow(role: string | null, canEditLegalWorkflow: boolean) {
  return role === "admin" || canEditLegalWorkflow;
}

function legacyStageDefinition(stage: string): LegalWorkflowStageDefinition | null {
  return legalWorkflowStages.find((item) => item.legacyKey === stage) ?? null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function findStage(
  stageIdOrLegacyKey: string,
): Promise<{ row: StageRow | null; fallback: LegalWorkflowStageDefinition | null }> {
  const { supabase, companyId } = await getCurrentUserContext();
  const query = supabase
    .from("legal_workflow_stages")
    .select("id, legacy_key, title, short_title, description, color, expected_documents, position")
    .eq("company_id", companyId);
  const { data, error } = isUuid(stageIdOrLegacyKey)
    ? await query.eq("id", stageIdOrLegacyKey).maybeSingle()
    : await query.eq("legacy_key", stageIdOrLegacyKey).maybeSingle();

  if (error) {
    if (isMissingWorkflowSchema(error.message)) {
      return {
        row: null,
        fallback: legacyStageDefinition(stageIdOrLegacyKey),
      };
    }

    throw new Error(error.message);
  }

  return {
    row: (data as StageRow | null) ?? null,
    fallback: null,
  };
}

function stageLabel(stage: StageRow | LegalWorkflowStageDefinition) {
  return "short_title" in stage ? stage.short_title : stage.shortLabel;
}

function stageLegacyKey(stage: StageRow | LegalWorkflowStageDefinition) {
  return "legacy_key" in stage ? stage.legacy_key : stage.legacyKey;
}

function stageDatabaseId(stage: StageRow | LegalWorkflowStageDefinition) {
  return "legacy_key" in stage ? stage.id : null;
}

function revalidateWorkflow(preSaleIds: string[] = []) {
  revalidatePath("/juridico");
  revalidatePath("/documentos/templates");
  revalidatePath("/emails/templates");
  revalidatePath("/documentos");
  for (const preSaleId of preSaleIds) {
    revalidatePath(`/pre-vendas/${preSaleId}`);
  }
}

export async function updateLegalWorkflowStageAction(
  preSaleId: string,
  stageId: string,
  changeNote?: string | null,
): Promise<LegalWorkflowActionState> {
  const normalizedChangeNote = changeNote?.trim();

  if (!normalizedChangeNote) {
    return friendlyError("Descreva a movimentacao juridica e o motivo.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();

    if (
      role !== "admin" &&
      role !== "manager" &&
      !(role === "seller" && businessArea === "legal")
    ) {
      return friendlyError("O usuario atual nao pode movimentar a esteira juridica.");
    }

    const preSale = await assertPreSaleAccess(preSaleId);
    const stageResult = await findStage(stageId);
    const targetStage = stageResult.row ?? stageResult.fallback;

    if (!targetStage) {
      return friendlyError("A etapa juridica selecionada nao existe mais.");
    }

    const { data: currentStageData, error: currentStageError } = await supabase
      .from("pre_sales")
      .select("legal_stage, legal_stage_id")
      .eq("id", preSale.id)
      .eq("company_id", companyId)
      .single();

    if (currentStageError || !currentStageData) {
      return friendlyError("Pre-venda nao encontrada para atualizar a etapa juridica.");
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      legal_stage: stageLegacyKey(targetStage),
      legal_stage_updated_at: now,
      updated_at: now,
    };
    const targetDatabaseId = stageDatabaseId(targetStage);

    if (targetDatabaseId) {
      updatePayload.legal_stage_id = targetDatabaseId;
    }

    const { error } = await supabase
      .from("pre_sales")
      .update(updatePayload)
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
        previous_stage_id: currentStageData.legal_stage_id,
        next_stage_id: targetDatabaseId,
        next_stage: stageLegacyKey(targetStage),
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId: preSale.client_id,
      preSaleId: preSale.id,
      eventType: "legal_stage_updated",
      title: `Esteira juridica movida para ${stageLabel(targetStage)}`,
      note: normalizedChangeNote,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        previous_stage_id: currentStageData.legal_stage_id,
        previous_stage: currentStageData.legal_stage,
        next_stage_id: targetDatabaseId,
        next_stage: stageLegacyKey(targetStage),
      },
    });

    revalidateWorkflow([preSale.id]);
    return {
      ok: true,
      message: `Cliente movido para ${stageLabel(targetStage)}.`,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar a etapa juridica.",
    );
  }
}

export async function createLegalWorkflowStageAction(
  values: LegalWorkflowStagePayload,
): Promise<LegalWorkflowActionState> {
  const parsed = stageSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError(parsed.error.issues[0]?.message ?? "Confira os dados da nova coluna.");
  }

  try {
    const { supabase, companyId, userProfileId, role, canEditLegalWorkflow } =
      await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para editar a esteira juridica.");
    }

    const { count, error: countError } = await supabase
      .from("legal_workflow_stages")
      .select("id", { head: true, count: "exact" })
      .eq("company_id", companyId);

    if (countError) {
      return friendlyError(
        isMissingWorkflowSchema(countError.message)
          ? "Execute o SQL docs/sql/juridico-esteira-configuravel.sql no Supabase."
          : countError.message,
      );
    }

    if ((count ?? 0) >= 20) {
      return friendlyError("A esteira juridica aceita no maximo 20 colunas.");
    }

    const { data: lastStage, error: lastStageError } = await supabase
      .from("legal_workflow_stages")
      .select("position")
      .eq("company_id", companyId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastStageError) {
      return friendlyError(lastStageError.message);
    }

    const { data, error } = await supabase
      .from("legal_workflow_stages")
      .insert({
        company_id: companyId,
        title: parsed.data.title,
        short_title: parsed.data.shortTitle,
        description: parsed.data.description,
        color: parsed.data.color,
        expected_documents: parsed.data.expectedDocuments,
        position: Number(lastStage?.position ?? 0) + 1,
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      const duplicate = error.message.toLowerCase().includes("duplicate");
      return friendlyError(
        duplicate
          ? "Ja existe uma coluna com este titulo ou esta descricao."
          : error.message,
      );
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.stage_created",
      entityType: "legal_workflow_stage",
      entityId: data.id,
      entityLabel: parsed.data.title,
      details: parsed.data,
    });

    revalidateWorkflow();
    return { ok: true, message: "Coluna criada no fim da esteira." };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar a coluna.",
    );
  }
}

export async function updateLegalWorkflowStageDefinitionAction(
  stageId: string,
  values: LegalWorkflowStagePayload,
): Promise<LegalWorkflowActionState> {
  const parsed = stageSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError(parsed.error.issues[0]?.message ?? "Confira os dados da coluna.");
  }

  try {
    const { supabase, companyId, userProfileId, role, canEditLegalWorkflow } =
      await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para editar a esteira juridica.");
    }

    const { error } = await supabase
      .from("legal_workflow_stages")
      .update({
        title: parsed.data.title,
        short_title: parsed.data.shortTitle,
        description: parsed.data.description,
        color: parsed.data.color,
        expected_documents: parsed.data.expectedDocuments,
        updated_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stageId)
      .eq("company_id", companyId);

    if (error) {
      const duplicate = error.message.toLowerCase().includes("duplicate");
      return friendlyError(
        duplicate
          ? "Ja existe uma coluna com este titulo ou esta descricao."
          : error.message,
      );
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.stage_definition_updated",
      entityType: "legal_workflow_stage",
      entityId: stageId,
      entityLabel: parsed.data.title,
      details: parsed.data,
    });

    revalidateWorkflow();
    return { ok: true, message: "Coluna atualizada." };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar a coluna.",
    );
  }
}

export async function reorderLegalWorkflowStagesAction(
  orderedStageIds: string[],
): Promise<LegalWorkflowActionState> {
  try {
    const { supabase, companyId, userProfileId, role, canEditLegalWorkflow } =
      await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para ordenar a esteira juridica.");
    }

    const uniqueIds = [...new Set(orderedStageIds)];
    const { data: companyStages, error: companyStagesError } = await supabase
      .from("legal_workflow_stages")
      .select("id")
      .eq("company_id", companyId);

    if (companyStagesError) {
      return friendlyError(companyStagesError.message);
    }

    if (
      uniqueIds.length !== (companyStages ?? []).length ||
      uniqueIds.some((id) => !(companyStages ?? []).some((stage) => stage.id === id))
    ) {
      return friendlyError("A lista de colunas esta incompleta ou desatualizada.");
    }

    for (const [index, id] of uniqueIds.entries()) {
      const { error } = await supabase
        .from("legal_workflow_stages")
        .update({
          position: index + 1,
          updated_by: userProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) {
        return friendlyError(error.message);
      }
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.stages_reordered",
      entityType: "legal_workflow",
      entityId: companyId,
      details: { ordered_stage_ids: uniqueIds },
    });

    revalidateWorkflow();
    return { ok: true, message: "Ordem da esteira atualizada." };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel ordenar as colunas.",
    );
  }
}

export async function deleteLegalWorkflowStageAction(
  stageId: string,
): Promise<LegalWorkflowActionState> {
  try {
    const { supabase, companyId, userProfileId, role, canEditLegalWorkflow } =
      await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para excluir colunas.");
    }

    const { data: stage, error: stageError } = await supabase
      .from("legal_workflow_stages")
      .select("id, title")
      .eq("id", stageId)
      .eq("company_id", companyId)
      .single();

    if (stageError || !stage) {
      return friendlyError("A coluna selecionada nao foi encontrada.");
    }

    const { count, error: countError } = await supabase
      .from("pre_sales")
      .select("id", { head: true, count: "exact" })
      .eq("company_id", companyId)
      .eq("legal_stage_id", stageId);

    if (countError) {
      return friendlyError(countError.message);
    }

    if ((count ?? 0) > 0) {
      return friendlyError(
        `Esta coluna possui ${count} cliente(s), inclusive clientes inativos ou em distrato. Mova todos antes de excluir.`,
      );
    }

    const { count: stageCount, error: stageCountError } = await supabase
      .from("legal_workflow_stages")
      .select("id", { head: true, count: "exact" })
      .eq("company_id", companyId);

    if (stageCountError) {
      return friendlyError(stageCountError.message);
    }

    if ((stageCount ?? 0) <= 1) {
      return friendlyError("A esteira precisa manter pelo menos uma coluna.");
    }

    const adminClient = createAdminClient();
    const [{ error: documentTemplateError }, { error: emailTemplateError }] =
      await Promise.all([
        adminClient
          .from("document_templates")
          .update({
            legal_stage_id: null,
            legal_stage: null,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId)
          .eq("legal_stage_id", stageId),
        adminClient
          .from("email_templates")
          .update({
            legal_stage_id: null,
            legal_stage: null,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId)
          .eq("legal_stage_id", stageId),
      ]);

    if (documentTemplateError || emailTemplateError) {
      return friendlyError(
        documentTemplateError?.message ??
          emailTemplateError?.message ??
          "Nao foi possivel desvincular os templates.",
      );
    }

    const { error } = await supabase
      .from("legal_workflow_stages")
      .delete()
      .eq("id", stageId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    const { data: remainingStages } = await supabase
      .from("legal_workflow_stages")
      .select("id")
      .eq("company_id", companyId)
      .order("position", { ascending: true });

    for (const [index, remainingStage] of (remainingStages ?? []).entries()) {
      await supabase
        .from("legal_workflow_stages")
        .update({ position: index + 1 })
        .eq("id", remainingStage.id)
        .eq("company_id", companyId);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.stage_deleted",
      entityType: "legal_workflow_stage",
      entityId: stageId,
      entityLabel: stage.title,
      details: {
        templates_unlinked: true,
      },
    });

    revalidateWorkflow();
    return {
      ok: true,
      message: "Coluna excluida. Os templates foram mantidos e ficaram sem etapa vinculada.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir a coluna.",
    );
  }
}

export async function moveLegalClientsBulkAction(
  preSaleIds: string[],
  targetStageId: string,
  note: string,
): Promise<LegalWorkflowActionState> {
  const normalizedNote = note.trim();
  const uniqueIds = [...new Set(preSaleIds)].slice(0, 500);

  if (!uniqueIds.length) {
    return friendlyError("Selecione pelo menos um cliente.");
  }

  if (!normalizedNote) {
    return friendlyError("Descreva o motivo da movimentacao em massa.");
  }

  try {
    const {
      supabase,
      companyId,
      userProfileId,
      role,
      businessArea,
      profile,
      canEditLegalWorkflow,
    } = await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para mover clientes em massa.");
    }

    const stageResult = await findStage(targetStageId);
    const targetStage = stageResult.row;

    if (!targetStage) {
      return friendlyError("A etapa de destino nao foi encontrada.");
    }

    const { data: preSales, error: preSalesError } = await supabase
      .from("pre_sales")
      .select("id, client_id, legal_stage_id, legal_stage")
      .eq("company_id", companyId)
      .in("id", uniqueIds);

    if (preSalesError) {
      return friendlyError(preSalesError.message);
    }

    const movable = (preSales ?? []).filter(
      (preSale) =>
        preSale.legal_stage_id &&
        preSale.legal_stage_id !== targetStage.id,
    );

    if (!movable.length) {
      return friendlyError("Os clientes selecionados ja estao nesta coluna.");
    }

    if (movable.some((preSale) => !preSale.legal_stage_id)) {
      return friendlyError("Atualize a pagina antes de mover clientes antigos em massa.");
    }

    const undoExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: batch, error: batchError } = await supabase
      .from("legal_workflow_bulk_moves")
      .insert({
        company_id: companyId,
        target_stage_id: targetStage.id,
        note: normalizedNote,
        moved_count: movable.length,
        created_by: userProfileId,
        undo_expires_at: undoExpiresAt,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      return friendlyError(batchError?.message ?? "Nao foi possivel criar o lote.");
    }

    const { error: itemsError } = await supabase
      .from("legal_workflow_bulk_move_items")
      .insert(
        movable.map((preSale) => ({
          company_id: companyId,
          bulk_move_id: batch.id,
          pre_sale_id: preSale.id,
          client_id: preSale.client_id,
          previous_stage_id: preSale.legal_stage_id,
          target_stage_id: targetStage.id,
        })),
      );

    if (itemsError) {
      await supabase.from("legal_workflow_bulk_moves").delete().eq("id", batch.id);
      return friendlyError(itemsError.message);
    }

    const now = new Date().toISOString();
    const movedIds = movable.map((preSale) => preSale.id);
    const { error: moveError } = await supabase
      .from("pre_sales")
      .update({
        legal_stage_id: targetStage.id,
        legal_stage: targetStage.legacy_key,
        legal_stage_updated_at: now,
        updated_at: now,
      })
      .eq("company_id", companyId)
      .in("id", movedIds);

    if (moveError) {
      await supabase
        .from("legal_workflow_bulk_move_items")
        .delete()
        .eq("bulk_move_id", batch.id);
      await supabase.from("legal_workflow_bulk_moves").delete().eq("id", batch.id);
      return friendlyError(moveError.message);
    }

    await Promise.all(
      movable.map((preSale) =>
        recordClientTimelineEvent({
          companyId,
          clientId: preSale.client_id,
          preSaleId: preSale.id,
          eventType: "legal_stage_updated",
          title: `Movimentacao em massa para ${targetStage.short_title}`,
          note: normalizedNote,
          actorUserProfileId: userProfileId,
          actorRole: role,
          actorBusinessArea: businessArea,
          actor: profile,
          details: {
            bulk_move_id: batch.id,
            previous_stage_id: preSale.legal_stage_id,
            previous_stage: preSale.legal_stage,
            next_stage_id: targetStage.id,
            next_stage: targetStage.legacy_key,
          },
        }),
      ),
    );

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.bulk_moved",
      entityType: "legal_workflow_bulk_move",
      entityId: batch.id,
      details: {
        pre_sale_ids: movedIds,
        target_stage_id: targetStage.id,
        note: normalizedNote,
        undo_expires_at: undoExpiresAt,
      },
    });

    revalidateWorkflow(movedIds);
    return {
      ok: true,
      message: `${movable.length} cliente(s) movido(s) para ${targetStage.short_title}.`,
      batchId: batch.id,
      undoExpiresAt,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel mover os clientes.",
    );
  }
}

export async function undoLegalClientsBulkAction(
  batchId: string,
): Promise<LegalWorkflowActionState> {
  try {
    const {
      supabase,
      companyId,
      userProfileId,
      role,
      businessArea,
      profile,
      canEditLegalWorkflow,
    } = await getCurrentUserContext();

    if (!canEditWorkflow(role, canEditLegalWorkflow)) {
      return friendlyError("Voce nao tem permissao para desfazer movimentacoes.");
    }

    const { data: batch, error: batchError } = await supabase
      .from("legal_workflow_bulk_moves")
      .select("id, created_by, undone_at, undo_expires_at")
      .eq("id", batchId)
      .eq("company_id", companyId)
      .single();

    if (batchError || !batch) {
      return friendlyError("A movimentacao em massa nao foi encontrada.");
    }

    if (batch.undone_at) {
      return friendlyError("Esta movimentacao ja foi desfeita.");
    }

    if (new Date(batch.undo_expires_at).getTime() < Date.now()) {
      return friendlyError("O prazo de 10 minutos para desfazer esta movimentacao terminou.");
    }

    const { data: items, error: itemsError } = await supabase
      .from("legal_workflow_bulk_move_items")
      .select("pre_sale_id, client_id, previous_stage_id, target_stage_id")
      .eq("bulk_move_id", batchId)
      .eq("company_id", companyId);

    if (itemsError || !items?.length) {
      return friendlyError(itemsError?.message ?? "O lote nao possui clientes para restaurar.");
    }

    const previousStageIds = [...new Set(items.map((item) => item.previous_stage_id))];
    const { data: previousStages, error: stagesError } = await supabase
      .from("legal_workflow_stages")
      .select("id, legacy_key, short_title")
      .eq("company_id", companyId)
      .in("id", previousStageIds);

    if (stagesError || previousStages?.length !== previousStageIds.length) {
      return friendlyError("Uma das colunas de origem nao existe mais.");
    }

    const now = new Date().toISOString();
    for (const stage of previousStages) {
      const stageItems = items.filter((item) => item.previous_stage_id === stage.id);
      const { error } = await supabase
        .from("pre_sales")
        .update({
          legal_stage_id: stage.id,
          legal_stage: stage.legacy_key,
          legal_stage_updated_at: now,
          updated_at: now,
        })
        .eq("company_id", companyId)
        .in(
          "id",
          stageItems.map((item) => item.pre_sale_id),
        );

      if (error) {
        return friendlyError(error.message);
      }
    }

    await Promise.all(
      items.map(async (item) => {
        const previousStage = previousStages.find(
          (stage) => stage.id === item.previous_stage_id,
        );
        return recordClientTimelineEvent({
          companyId,
          clientId: item.client_id,
          preSaleId: item.pre_sale_id,
          eventType: "legal_stage_updated",
          title: `Movimentacao em massa desfeita para ${previousStage?.short_title ?? "etapa anterior"}`,
          note: "Desfazer aplicado dentro do prazo de seguranca.",
          actorUserProfileId: userProfileId,
          actorRole: role,
          actorBusinessArea: businessArea,
          actor: profile,
          details: {
            bulk_move_id: batchId,
            undo: true,
            previous_stage_id: item.target_stage_id,
            next_stage_id: item.previous_stage_id,
          },
        });
      }),
    );

    const { error: undoError } = await supabase
      .from("legal_workflow_bulk_moves")
      .update({
        undone_at: now,
        undone_by: userProfileId,
      })
      .eq("id", batchId)
      .eq("company_id", companyId);

    if (undoError) {
      return friendlyError(undoError.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "legal_workflow.bulk_move_undone",
      entityType: "legal_workflow_bulk_move",
      entityId: batchId,
      details: {
        pre_sale_ids: items.map((item) => item.pre_sale_id),
      },
    });

    revalidateWorkflow(items.map((item) => item.pre_sale_id));
    return { ok: true, message: `${items.length} cliente(s) retornaram as colunas anteriores.` };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel desfazer a movimentacao.",
    );
  }
}
