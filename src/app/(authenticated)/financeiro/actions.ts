"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { parseFinanceWorkbook } from "@/lib/finance/importer";
import {
  validateFinanceUploadMetadata,
  validateFinanceUploadSignature,
} from "@/lib/finance/upload-validation";

function redirectWithMessage(
  type: "success" | "error",
  message: string,
  path = "/financeiro",
) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${type}=${encodeURIComponent(message)}`);
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function resolveRedirectPath(formData?: FormData) {
  const path = normalizeText(formData?.get("redirect_to") ?? null);

  if (path?.startsWith("/financeiro")) {
    return path;
  }

  return "/financeiro";
}

function requireDate(value: FormDataEntryValue | null, fieldName: string) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(`${fieldName} e obrigatório.`);
  }

  return text.slice(0, 10);
}

function parseMoney(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  const clean = text
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastDot > lastComma
        ? clean.replace(/,/g, "")
        : clean.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0 && !/\.\d{1,2}$/.test(clean)) {
    normalized = clean.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCpf(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length ? digits.slice(0, 11) : null;
}

function parseImportYear(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/\D/g, ""));
  const currentYear = new Date().getFullYear();

  return parsed >= 2020 && parsed <= currentYear + 1 ? parsed : currentYear;
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  return text || null;
}

async function requireFinanceAdmin() {
  const context = await getCurrentUserContext();

  if (context.role !== "admin") {
    throw new Error("Apenas usuários master podem acessar o financeiro.");
  }

  return context;
}

function normalizeDatabaseError(error: { message?: string; code?: string } | Error | null) {
  const message = error instanceof Error ? error.message : error?.message;

  if (!message) {
    return "Não foi possível concluir a operação.";
  }

  if (
    message.toLowerCase().includes("could not find") ||
    message.toLowerCase().includes("schema cache") ||
    message.toLowerCase().includes("does not exist")
  ) {
    return "As tabelas do financeiro ainda não existem no Supabase. Rode o SQL docs/sql/financeiro.sql.";
  }

  return message;
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

type FinanceContext = Awaited<ReturnType<typeof requireFinanceAdmin>>;
type FinanceSupabaseClient = FinanceContext["supabase"];
type FinanceAuditEntityType = "transaction" | "sale" | "chargeback";
type FinanceAuditActionType = "create" | "update" | "delete" | "restore";

const financeEntityTables: Record<FinanceAuditEntityType, string> = {
  transaction: "finance_transactions",
  sale: "finance_sales",
  chargeback: "finance_chargebacks",
};

function getRecordId(record: Record<string, unknown> | null) {
  const id = record?.id;
  return typeof id === "string" ? id : null;
}

async function fetchFinanceEntity(
  supabase: FinanceSupabaseClient,
  table: string,
  companyId: string,
  id: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Registro financeiro não encontrado.");
  }

  return data as Record<string, unknown>;
}

async function recordFinanceAuditLog({
  supabase,
  companyId,
  userProfileId,
  entityType,
  actionType,
  entityLabel,
  beforeData,
  afterData,
}: {
  supabase: FinanceSupabaseClient;
  companyId: string;
  userProfileId: string;
  entityType: FinanceAuditEntityType;
  actionType: FinanceAuditActionType;
  entityLabel?: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}) {
  const entityId = getRecordId(afterData) ?? getRecordId(beforeData);

  if (!entityId) {
    return;
  }

  const { error } = await supabase.from("finance_audit_logs").insert({
    company_id: companyId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    entity_label: entityLabel ?? null,
    before_data: beforeData,
    after_data: afterData,
    changed_by: userProfileId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createFinanceTransactionAction(formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const description = normalizeText(formData.get("description"));

    if (!description) {
      throw new Error("Informe a descrição do lançamento.");
    }

    const payload = {
      company_id: companyId,
      direction: normalizeText(formData.get("direction")) === "income" ? "income" : "expense",
      status: normalizeText(formData.get("status")) ?? "planned",
      due_date: requireDate(formData.get("due_date"), "Vencimento"),
      paid_at: normalizeText(formData.get("paid_at")),
      description,
      counterparty: normalizeText(formData.get("counterparty")),
      category_id: optionalUuid(formData.get("category_id")),
      account_id: optionalUuid(formData.get("account_id")),
      amount_expected: parseMoney(formData.get("amount_expected")),
      amount_paid: normalizeText(formData.get("amount_paid"))
        ? parseMoney(formData.get("amount_paid"))
        : null,
      payment_method: normalizeText(formData.get("payment_method")),
      notes: normalizeText(formData.get("notes")),
      source: "manual",
      created_by: userProfileId,
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: createdTransaction, error } = await supabase
      .from("finance_transactions")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "transaction",
      actionType: "create",
      entityLabel: description,
      beforeData: null,
      afterData: createdTransaction as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.transaction.created",
      entityType: "finance_transaction",
      entityLabel: description,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Lancamento financeiro cadastrado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function updateFinanceTransactionAction(id: string, formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(
      supabase,
      "finance_transactions",
      companyId,
      id,
    );
    const description = normalizeText(formData.get("description"));

    if (!description) {
      throw new Error("Informe a descrição do lançamento.");
    }

    const payload = {
      direction: normalizeText(formData.get("direction")) === "income" ? "income" : "expense",
      status: normalizeText(formData.get("status")) ?? "planned",
      due_date: requireDate(formData.get("due_date"), "Vencimento"),
      paid_at: normalizeText(formData.get("paid_at")),
      description,
      counterparty: normalizeText(formData.get("counterparty")),
      category_id: optionalUuid(formData.get("category_id")),
      account_id: optionalUuid(formData.get("account_id")),
      amount_expected: parseMoney(formData.get("amount_expected")),
      amount_paid: normalizeText(formData.get("amount_paid"))
        ? parseMoney(formData.get("amount_paid"))
        : null,
      payment_method: normalizeText(formData.get("payment_method")),
      notes: normalizeText(formData.get("notes")),
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedTransaction, error } = await supabase
      .from("finance_transactions")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "transaction",
      actionType: "update",
      entityLabel: description,
      beforeData,
      afterData: updatedTransaction as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.transaction.updated",
      entityType: "finance_transaction",
      entityId: id,
      entityLabel: description,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Lancamento financeiro atualizado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceTransactionAction(id: string, formData?: FormData) {
  const redirectPath = resolveRedirectPath(formData);

  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(
      supabase,
      "finance_transactions",
      companyId,
      id,
    );
    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "transaction",
      actionType: "delete",
      entityLabel: String(beforeData.description ?? "Lancamento financeiro"),
      beforeData,
      afterData: null,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.transaction.deleted",
      entityType: "finance_transaction",
      entityId: id,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Lancamento removido.", redirectPath);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error), redirectPath);
  }
}

export async function createFinanceSaleAction(formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const clientName = normalizeText(formData.get("client_name"));

    if (!clientName) {
      throw new Error("Informe o nome do cliente.");
    }

    const payload = {
      company_id: companyId,
      sale_date: requireDate(formData.get("sale_date"), "Data da venda"),
      client_name: clientName,
      client_cpf: normalizeCpf(formData.get("client_cpf")),
      consultant_user_id: optionalUuid(formData.get("consultant_user_id")),
      consultant_name: normalizeText(formData.get("consultant_name")),
      modality: normalizeText(formData.get("modality")),
      platform: normalizeText(formData.get("platform")),
      installment_count: normalizeText(formData.get("installment_count")),
      gross_amount: parseMoney(formData.get("gross_amount")),
      goal_amount: parseMoney(formData.get("goal_amount")),
      debtor_amount: normalizeText(formData.get("debtor_amount"))
        ? parseMoney(formData.get("debtor_amount"))
        : null,
      award_amount: normalizeText(formData.get("award_amount"))
        ? parseMoney(formData.get("award_amount"))
        : null,
      report_amount: normalizeText(formData.get("report_amount"))
        ? parseMoney(formData.get("report_amount"))
        : null,
      status: normalizeText(formData.get("status")) ?? "confirmed",
      source: "manual",
      notes: normalizeText(formData.get("notes")),
      created_by: userProfileId,
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: createdSale, error } = await supabase
      .from("finance_sales")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "sale",
      actionType: "create",
      entityLabel: clientName,
      beforeData: null,
      afterData: createdSale as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.sale.created",
      entityType: "finance_sale",
      entityLabel: clientName,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Venda cadastrada no financeiro.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function updateFinanceSaleAction(id: string, formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(
      supabase,
      "finance_sales",
      companyId,
      id,
    );
    const clientName = normalizeText(formData.get("client_name"));

    if (!clientName) {
      throw new Error("Informe o nome do cliente.");
    }

    const payload = {
      sale_date: requireDate(formData.get("sale_date"), "Data da venda"),
      client_name: clientName,
      client_cpf: normalizeCpf(formData.get("client_cpf")),
      consultant_user_id: optionalUuid(formData.get("consultant_user_id")),
      consultant_name: normalizeText(formData.get("consultant_name")),
      modality: normalizeText(formData.get("modality")),
      platform: normalizeText(formData.get("platform")),
      installment_count: normalizeText(formData.get("installment_count")),
      gross_amount: parseMoney(formData.get("gross_amount")),
      goal_amount: parseMoney(formData.get("goal_amount")),
      debtor_amount: normalizeText(formData.get("debtor_amount"))
        ? parseMoney(formData.get("debtor_amount"))
        : null,
      award_amount: normalizeText(formData.get("award_amount"))
        ? parseMoney(formData.get("award_amount"))
        : null,
      report_amount: normalizeText(formData.get("report_amount"))
        ? parseMoney(formData.get("report_amount"))
        : null,
      status: normalizeText(formData.get("status")) ?? "confirmed",
      notes: normalizeText(formData.get("notes")),
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSale, error } = await supabase
      .from("finance_sales")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "sale",
      actionType: "update",
      entityLabel: clientName,
      beforeData,
      afterData: updatedSale as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.sale.updated",
      entityType: "finance_sale",
      entityId: id,
      entityLabel: clientName,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Venda atualizada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceSaleAction(id: string, formData?: FormData) {
  const redirectPath = resolveRedirectPath(formData);

  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(supabase, "finance_sales", companyId, id);
    const { error } = await supabase
      .from("finance_sales")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "sale",
      actionType: "delete",
      entityLabel: String(beforeData.client_name ?? "Venda"),
      beforeData,
      afterData: null,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.sale.deleted",
      entityType: "finance_sale",
      entityId: id,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Venda removida.", redirectPath);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error), redirectPath);
  }
}

export async function createFinanceChargebackAction(formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const clientName = normalizeText(formData.get("client_name"));

    if (!clientName) {
      throw new Error("Informe o nome do cliente.");
    }

    const payload = {
      company_id: companyId,
      chargeback_date: requireDate(formData.get("chargeback_date"), "Data"),
      client_name: clientName,
      client_cpf: normalizeCpf(formData.get("client_cpf")),
      amount: parseMoney(formData.get("amount")),
      charged_at: normalizeText(formData.get("charged_at")),
      status: normalizeText(formData.get("status")) ?? "pending",
      source: "manual",
      notes: normalizeText(formData.get("notes")),
      created_by: userProfileId,
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: createdChargeback, error } = await supabase
      .from("finance_chargebacks")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "chargeback",
      actionType: "create",
      entityLabel: clientName,
      beforeData: null,
      afterData: createdChargeback as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.chargeback.created",
      entityType: "finance_chargeback",
      entityLabel: clientName,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Chargeback cadastrado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function updateFinanceChargebackAction(id: string, formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(
      supabase,
      "finance_chargebacks",
      companyId,
      id,
    );
    const clientName = normalizeText(formData.get("client_name"));

    if (!clientName) {
      throw new Error("Informe o nome do cliente.");
    }

    const payload = {
      chargeback_date: requireDate(formData.get("chargeback_date"), "Data"),
      client_name: clientName,
      client_cpf: normalizeCpf(formData.get("client_cpf")),
      amount: parseMoney(formData.get("amount")),
      charged_at: normalizeText(formData.get("charged_at")),
      status: normalizeText(formData.get("status")) ?? "pending",
      notes: normalizeText(formData.get("notes")),
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedChargeback, error } = await supabase
      .from("finance_chargebacks")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "chargeback",
      actionType: "update",
      entityLabel: clientName,
      beforeData,
      afterData: updatedChargeback as Record<string, unknown>,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.chargeback.updated",
      entityType: "finance_chargeback",
      entityId: id,
      entityLabel: clientName,
      details: payload,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Chargeback atualizado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceChargebackAction(id: string, formData?: FormData) {
  const redirectPath = resolveRedirectPath(formData);

  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const beforeData = await fetchFinanceEntity(
      supabase,
      "finance_chargebacks",
      companyId,
      id,
    );
    const { error } = await supabase
      .from("finance_chargebacks")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType: "chargeback",
      actionType: "delete",
      entityLabel: String(beforeData.client_name ?? "Chargeback"),
      beforeData,
      afterData: null,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.chargeback.deleted",
      entityType: "finance_chargeback",
      entityId: id,
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Chargeback removido.", redirectPath);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error), redirectPath);
  }
}

export async function restoreFinanceAuditLogAction(id: string) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const { data: auditLog, error: auditError } = await supabase
      .from("finance_audit_logs")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (auditError) {
      throw new Error(auditError.message);
    }

    if (!auditLog) {
      throw new Error("Log financeiro não encontrado.");
    }

    if (auditLog.restored_at) {
      throw new Error("Esta alteração já foi restaurada.");
    }

    const entityType = auditLog.entity_type as FinanceAuditEntityType;
    const table = financeEntityTables[entityType];

    if (!table) {
      throw new Error("Tipo de registro financeiro inválido.");
    }

    const beforeData = auditLog.before_data as Record<string, unknown> | null;
    const afterData = auditLog.after_data as Record<string, unknown> | null;
    const entityId = getRecordId(afterData) ?? getRecordId(beforeData);

    if (!entityId) {
      throw new Error("Não foi possível identificar o registro para restaurar.");
    }

    if (auditLog.action_type === "create") {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", entityId)
        .eq("company_id", companyId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      if (!beforeData) {
        throw new Error("Este log não possui dados anteriores para restaurar.");
      }

      const { error } = await supabase
        .from(table)
        .upsert(
          {
            ...beforeData,
            company_id: companyId,
            updated_by: userProfileId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

      if (error) {
        throw new Error(error.message);
      }
    }

    const { error: updateLogError } = await supabase
      .from("finance_audit_logs")
      .update({
        restored_at: new Date().toISOString(),
        restored_by: userProfileId,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (updateLogError) {
      throw new Error(updateLogError.message);
    }

    await recordFinanceAuditLog({
      supabase,
      companyId,
      userProfileId,
      entityType,
      actionType: "restore",
      entityLabel: auditLog.entity_label,
      beforeData: afterData,
      afterData: beforeData,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.audit.restored",
      entityType: "finance_audit_log",
      entityId: id,
      entityLabel: auditLog.entity_label,
      details: {
        entity_type: entityType,
        entity_id: entityId,
        restored_action: auditLog.action_type,
      },
    });

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
    redirectWithMessage("success", "Alteração financeira restaurada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>,
) {
  for (let index = 0; index < rows.length; index += 300) {
    const chunk = rows.slice(index, index + 300);
    const { error } = await insert(chunk);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function importFinanceFilesAction(formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (!files.length) {
      throw new Error("Selecione pelo menos uma planilha para importar.");
    }

    let totalTransactions = 0;
    let totalSales = 0;
    let totalChargebacks = 0;
    let totalIgnored = 0;
    const importYear = parseImportYear(formData.get("default_year"));

    for (const file of files) {
      const extension = validateFinanceUploadMetadata(file);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      validateFinanceUploadSignature(fileBuffer, extension);
      const parsed = parseFinanceWorkbook(
        fileBuffer,
        file.name,
        importYear,
      );
      const { data: batch, error: batchError } = await supabase
        .from("finance_import_batches")
        .insert({
          company_id: companyId,
          file_name: file.name,
          file_size_bytes: file.size,
          imported_by: userProfileId,
          status: parsed.ignoredRows.length ? "partial" : "completed",
          summary: parsed.summary,
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        throw new Error(batchError?.message ?? "Não foi possível registrar a importação.");
      }

      const transactionRows = parsed.transactions.map((item) => ({
        company_id: companyId,
        direction: item.direction,
        status: item.status,
        due_date: item.due_date,
        paid_at: item.paid_at,
        description: item.description,
        counterparty: item.counterparty,
        amount_expected: item.amount_expected,
        amount_paid: item.amount_paid,
        payment_method: item.payment_method,
        source: "excel_import",
        source_hash: item.source_hash,
        notes: item.notes,
        created_by: userProfileId,
      }));
      const saleRows = parsed.sales.map((item) => ({
        company_id: companyId,
        sale_date: item.sale_date,
        client_name: item.client_name,
        client_cpf: item.client_cpf,
        consultant_name: item.consultant_name,
        modality: item.modality,
        platform: item.platform,
        installment_count: item.installment_count,
        gross_amount: item.gross_amount,
        goal_amount: item.goal_amount,
        debtor_amount: item.debtor_amount,
        award_amount: item.award_amount,
        report_amount: item.report_amount,
        status: item.status,
        source: "excel_import",
        source_hash: item.source_hash,
        notes: item.notes,
        created_by: userProfileId,
      }));
      const chargebackRows = parsed.chargebacks.map((item) => ({
        company_id: companyId,
        chargeback_date: item.chargeback_date,
        client_name: item.client_name,
        client_cpf: item.client_cpf,
        amount: item.amount,
        charged_at: item.charged_at,
        status: item.status,
        source: "excel_import",
        source_hash: item.source_hash,
        notes: item.notes,
        created_by: userProfileId,
      }));

      await insertInChunks(transactionRows, (chunk) =>
        supabase
          .from("finance_transactions")
          .upsert(chunk, {
            onConflict: "company_id,source_hash",
            ignoreDuplicates: true,
          }),
      );
      await insertInChunks(saleRows, (chunk) =>
        supabase
          .from("finance_sales")
          .upsert(chunk, {
            onConflict: "company_id,source_hash",
            ignoreDuplicates: true,
          }),
      );
      await insertInChunks(chargebackRows, (chunk) =>
        supabase
          .from("finance_chargebacks")
          .upsert(chunk, {
            onConflict: "company_id,source_hash",
            ignoreDuplicates: true,
          }),
      );

      const importRows = [
        ...parsed.transactions.map((item) => ({
          company_id: companyId,
          batch_id: batch.id,
          row_type: "transaction",
          sheet_name: item.sheet_name,
          row_number: item.row_number,
          raw_data: item.raw_data,
        })),
        ...parsed.sales.map((item) => ({
          company_id: companyId,
          batch_id: batch.id,
          row_type: "sale",
          sheet_name: item.sheet_name,
          row_number: item.row_number,
          raw_data: item.raw_data,
        })),
        ...parsed.chargebacks.map((item) => ({
          company_id: companyId,
          batch_id: batch.id,
          row_type: "chargeback",
          sheet_name: item.sheet_name,
          row_number: item.row_number,
          raw_data: item.raw_data,
        })),
        ...parsed.ignoredRows.slice(0, 500).map((item) => ({
          company_id: companyId,
          batch_id: batch.id,
          row_type: "ignored",
          sheet_name: item.sheet_name,
          row_number: item.row_number,
          raw_data: item.raw_data,
          error_message: item.reason,
        })),
      ];

      await insertInChunks(importRows, (chunk) =>
        supabase.from("finance_import_rows").insert(chunk),
      );

      totalTransactions += parsed.transactions.length;
      totalSales += parsed.sales.length;
      totalChargebacks += parsed.chargebacks.length;
      totalIgnored += parsed.ignoredRows.length;
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.import.completed",
      entityType: "finance_import",
      entityLabel: `${files.length} arquivo(s)`,
      details: {
        files: files.map((file) => file.name),
        transactions: totalTransactions,
        sales: totalSales,
        chargebacks: totalChargebacks,
        ignoredRows: totalIgnored,
      },
    });

    revalidatePath("/financeiro");
    redirectWithMessage(
      "success",
      `Importação concluída: ${totalTransactions} lançamento(s), ${totalSales} venda(s), ${totalChargebacks} chargeback(s).`,
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}
