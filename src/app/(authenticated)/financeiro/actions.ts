"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { parseFinanceWorkbook } from "@/lib/finance/importer";

function redirectWithMessage(type: "success" | "error", message: string) {
  redirect(`/financeiro?${type}=${encodeURIComponent(message)}`);
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function requireDate(value: FormDataEntryValue | null, fieldName: string) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(`${fieldName} e obrigatorio.`);
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
    throw new Error("Apenas usuarios master podem acessar o financeiro.");
  }

  return context;
}

function normalizeDatabaseError(error: { message?: string; code?: string } | Error | null) {
  const message = error instanceof Error ? error.message : error?.message;

  if (!message) {
    return "Nao foi possivel concluir a operacao.";
  }

  if (
    message.toLowerCase().includes("could not find") ||
    message.toLowerCase().includes("schema cache") ||
    message.toLowerCase().includes("does not exist")
  ) {
    return "As tabelas do financeiro ainda nao existem no Supabase. Rode o SQL docs/sql/financeiro.sql.";
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

export async function createFinanceTransactionAction(formData: FormData) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const description = normalizeText(formData.get("description"));

    if (!description) {
      throw new Error("Informe a descricao do lancamento.");
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

    const { error } = await supabase.from("finance_transactions").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

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
    const description = normalizeText(formData.get("description"));

    if (!description) {
      throw new Error("Informe a descricao do lancamento.");
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

    const { error } = await supabase
      .from("finance_transactions")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

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
    redirectWithMessage("success", "Lancamento financeiro atualizado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceTransactionAction(id: string) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.transaction.deleted",
      entityType: "finance_transaction",
      entityId: id,
    });

    revalidatePath("/financeiro");
    redirectWithMessage("success", "Lancamento removido.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
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

    const { error } = await supabase.from("finance_sales").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

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

    const { error } = await supabase
      .from("finance_sales")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

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
    redirectWithMessage("success", "Venda atualizada.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceSaleAction(id: string) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const { error } = await supabase
      .from("finance_sales")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.sale.deleted",
      entityType: "finance_sale",
      entityId: id,
    });

    revalidatePath("/financeiro");
    redirectWithMessage("success", "Venda removida.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
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

    const { error } = await supabase.from("finance_chargebacks").insert(payload);

    if (error) {
      throw new Error(error.message);
    }

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

    const { error } = await supabase
      .from("finance_chargebacks")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

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
    redirectWithMessage("success", "Chargeback atualizado.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}

export async function deleteFinanceChargebackAction(id: string) {
  try {
    const { supabase, companyId, userProfileId } = await requireFinanceAdmin();
    const { error } = await supabase
      .from("finance_chargebacks")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "finance.chargeback.deleted",
      entityType: "finance_chargeback",
      entityId: id,
    });

    revalidatePath("/financeiro");
    redirectWithMessage("success", "Chargeback removido.");
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
      const parsed = parseFinanceWorkbook(
        Buffer.from(await file.arrayBuffer()),
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
        throw new Error(batchError?.message ?? "Nao foi possivel registrar a importacao.");
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
      `Importacao concluida: ${totalTransactions} lancamento(s), ${totalSales} venda(s), ${totalChargebacks} chargeback(s).`,
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithMessage("error", normalizeDatabaseError(error as Error));
  }
}
