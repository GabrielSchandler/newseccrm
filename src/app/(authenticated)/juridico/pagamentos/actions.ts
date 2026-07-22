"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  generateOfficialDocumentAction,
  generateOfficialPdfDocumentAction,
} from "@/app/(authenticated)/documentos/actions";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { assertPreSaleAccess } from "@/lib/pre-sales/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayName } from "@/lib/users/account";
import type { DocumentTemplate } from "@/types/document";
import type {
  LegalPayment,
  LegalPaymentStatus,
  LegalPaymentType,
} from "@/types/legal-payment";
import type { PreSaleClientSnapshot, UserProfileOption } from "@/types/pre-sale";

type CurrentUserContext = Awaited<ReturnType<typeof getCurrentUserContext>>;
type PaymentWriteContext = CurrentUserContext & {
  preSale: Awaited<ReturnType<typeof assertPreSaleAccess>>;
};

function canManageLegalPayments(role: string | null, businessArea: string) {
  return (
    role === "admin" ||
    role === "manager" ||
    businessArea === "legal"
  );
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeStatus(value: FormDataEntryValue | null): LegalPaymentStatus {
  const status = normalizeText(value);

  return status === "pago" ||
    status === "vencido" ||
    status === "cancelado" ||
    status === "previsto"
    ? status
    : "previsto";
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

function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  return text?.match(/^\d{4}-\d{2}-\d{2}$/) ? text : null;
}

function parseInstallment(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function redirectWithPaymentMessage(
  preSaleId: string,
  type: "success" | "error",
  message: string,
) {
  const key = type === "success" ? "legalPaymentSuccess" : "legalPaymentError";
  const target = preSaleId ? `/pre-vendas/${preSaleId}` : "/pre-vendas";
  const anchor = preSaleId ? "#pagamentos-juridicos" : "";

  redirect(
    `${target}?${key}=${encodeURIComponent(
      message,
    )}${anchor}`,
  );
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";

  if (
    message.toLowerCase().includes("schema cache") ||
    message.toLowerCase().includes("does not exist") ||
    message.toLowerCase().includes("could not find")
  ) {
    return "As tabelas de pagamentos jurídicos ainda não existem. Rode o SQL docs/sql/juridico-pagamentos.sql no Supabase.";
  }

  return message;
}

async function requireLegalPaymentContext(preSaleId: string): Promise<PaymentWriteContext> {
  const context = await getCurrentUserContext();

  if (!canManageLegalPayments(context.role, context.businessArea)) {
    throw new Error("O usuário atual não pode lançar pagamentos jurídicos.");
  }

  const preSale = await assertPreSaleAccess(preSaleId);

  return {
    ...context,
    preSale,
  };
}

async function ensureLegalResponsibleUser(
  context: CurrentUserContext,
  responsibleUserId: string | null,
) {
  if (!responsibleUserId) {
    throw new Error("Selecione o responsável jurídico pela venda/comissão.");
  }

  const { data, error } = await context.supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email, role, business_area, legal_role, is_active")
    .eq("id", responsibleUserId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const responsible = data as
    | (UserProfileOption & { is_active?: boolean | null })
    | null;

  if (!responsible || responsible.is_active === false || responsible.business_area !== "legal") {
    throw new Error("Selecione um usuário jurídico ativo para receber a venda.");
  }

  return responsible;
}

async function getLegalPaymentType(
  context: CurrentUserContext,
  legalPaymentTypeId: string | null,
) {
  if (!legalPaymentTypeId) {
    throw new Error("Selecione o tipo de cobrança jurídica.");
  }

  const { data, error } = await context.supabase
    .from("legal_payment_types")
    .select("*")
    .eq("id", legalPaymentTypeId)
    .eq("company_id", context.companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Tipo de cobrança jurídica não encontrado.");
  }

  return data as LegalPaymentType;
}

function buildPayloadFromForm(
  formData: FormData,
  context: PaymentWriteContext,
  responsibleUserId: string,
) {
  const status = normalizeStatus(formData.get("status"));
  const amount = parseMoney(formData.get("amount"));
  const goalAmount = normalizeText(formData.get("goal_amount"))
    ? parseMoney(formData.get("goal_amount"))
    : amount;
  const dueDate = normalizeDate(formData.get("due_date"));
  const paidAt =
    status === "pago"
      ? normalizeDate(formData.get("paid_at")) ?? todayYmd()
      : normalizeDate(formData.get("paid_at"));

  if (amount <= 0) {
    throw new Error("Informe um valor jurídico maior que zero.");
  }

  if (goalAmount < 0) {
    throw new Error("O valor meta não pode ser negativo.");
  }

  if ((status === "previsto" || status === "vencido") && !dueDate) {
    throw new Error("Informe a data prevista/vencimento do pagamento.");
  }

  return {
    company_id: context.companyId,
    pre_sale_id: context.preSale.id,
    client_id: context.preSale.client_id,
    legal_payment_type_id: optionalUuid(formData.get("legal_payment_type_id")),
    responsible_user_id: responsibleUserId,
    installment_number: parseInstallment(formData.get("installment_number")),
    description: normalizeText(formData.get("description")),
    amount,
    goal_amount: goalAmount,
    payment_method: normalizeText(formData.get("payment_method")),
    due_date: dueDate,
    paid_at: paidAt,
    status,
    notes: normalizeText(formData.get("notes")),
    updated_by: context.userProfileId,
    updated_at: new Date().toISOString(),
  };
}

async function loadPaymentContext(paymentId: string, context: CurrentUserContext) {
  const { data, error } = await context.supabase
    .from("legal_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const payment = data as LegalPayment | null;

  if (!payment) {
    throw new Error("Pagamento jurídico não encontrado.");
  }

  const preSale = await assertPreSaleAccess(payment.pre_sale_id);

  if (!canManageLegalPayments(context.role, context.businessArea)) {
    throw new Error("O usuário atual não pode alterar pagamentos jurídicos.");
  }

  return {
    payment,
    preSale,
  };
}

function financeTransactionStatus(status: LegalPaymentStatus) {
  if (status === "pago") {
    return "paid";
  }

  if (status === "vencido") {
    return "overdue";
  }

  if (status === "cancelado") {
    return "canceled";
  }

  return "planned";
}

async function getFinanceCategoryId(companyId: string) {
  const adminClient = createAdminClient();
  const { data: existing, error } = await adminClient
    .from("finance_categories")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", "Receita Jurídica")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: created, error: createError } = await adminClient
    .from("finance_categories")
    .insert({
      company_id: companyId,
      name: "Receita Jurídica",
      kind: "income",
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return (created as { id: string }).id;
}

async function syncPaymentWithFinance({
  payment,
  type,
  responsible,
  context,
}: {
  payment: LegalPayment;
  type: LegalPaymentType;
  responsible: UserProfileOption | null;
  context: CurrentUserContext;
}) {
  const adminClient = createAdminClient();
  const [{ data: snapshotData }, { data: clientData }] = await Promise.all([
    adminClient
      .from("pre_sale_client_snapshot")
      .select("full_name, cpf")
      .eq("pre_sale_id", payment.pre_sale_id)
      .maybeSingle(),
    adminClient
      .from("clients")
      .select("full_name, cpf")
      .eq("id", payment.client_id)
      .eq("company_id", context.companyId)
      .maybeSingle(),
  ]);
  const snapshot = snapshotData as PreSaleClientSnapshot | null;
  const client = clientData as { full_name: string | null; cpf: string | null } | null;
  const clientName = snapshot?.full_name || client?.full_name || "Cliente jurídico";
  const clientCpf = String(snapshot?.cpf || client?.cpf || "").replace(/\D/g, "") || null;
  const sourceHash = `legal_payment:${payment.id}`;
  const dueDate = payment.due_date ?? payment.paid_at ?? todayYmd();
  const paidAt = payment.status === "pago" ? payment.paid_at ?? todayYmd() : null;
  const categoryId = await getFinanceCategoryId(context.companyId);
  const responsibleName = responsible ? resolveUserDisplayName(responsible) : null;
  const description = `Recebimento jurídico - ${type.name} - ${clientName}`;
  const transactionStatus = financeTransactionStatus(payment.status);

  const { data: transactionData, error: transactionError } = await adminClient
    .from("finance_transactions")
    .upsert(
      {
        company_id: context.companyId,
        direction: "income",
        status: transactionStatus,
        due_date: dueDate,
        paid_at: paidAt,
        description,
        counterparty: clientName,
        category_id: categoryId,
        account_id: null,
        amount_expected: payment.amount,
        amount_paid: payment.status === "pago" ? payment.amount : null,
        payment_method: payment.payment_method,
        source: "legal_payment",
        source_hash: sourceHash,
        notes: payment.notes,
        created_by: context.userProfileId,
        updated_by: context.userProfileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,source_hash" },
    )
    .select("id")
    .single();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  let financeSaleId = payment.finance_sale_id;

  if (payment.status === "pago") {
    const { data: saleData, error: saleError } = await adminClient
      .from("finance_sales")
      .upsert(
        {
          company_id: context.companyId,
          sale_date: paidAt,
          client_name: clientName,
          client_cpf: clientCpf,
          consultant_user_id: payment.responsible_user_id,
          consultant_name: responsibleName,
          modality: "Jurídico",
          platform: type.name,
          installment_count: String(payment.installment_number ?? 1),
          gross_amount: payment.amount,
          goal_amount: payment.goal_amount,
          debtor_amount: null,
          award_amount: null,
          report_amount: null,
          status: "confirmed",
          source: "legal_payment",
          source_hash: sourceHash,
          notes: payment.description || payment.notes,
          created_by: context.userProfileId,
          updated_by: context.userProfileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,source_hash" },
      )
      .select("id")
      .single();

    if (saleError) {
      throw new Error(saleError.message);
    }

    financeSaleId = (saleData as { id: string }).id;
  } else if (payment.finance_sale_id) {
    await adminClient
      .from("finance_sales")
      .update({
        status: "canceled",
        updated_by: context.userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.finance_sale_id)
      .eq("company_id", context.companyId);
    financeSaleId = payment.finance_sale_id;
  }

  const financeTransactionId = (transactionData as { id: string }).id;

  await adminClient
    .from("legal_payments")
    .update({
      finance_transaction_id: financeTransactionId,
      finance_sale_id: financeSaleId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .eq("company_id", context.companyId);

  return {
    financeTransactionId,
    financeSaleId,
  };
}

async function recordLegalPaymentTimeline({
  context,
  payment,
  type,
  action,
}: {
  context: CurrentUserContext;
  payment: LegalPayment;
  type: LegalPaymentType;
  action: "created" | "updated" | "deleted" | "receipt";
}) {
  const titles = {
    created: `Pagamento jurídico cadastrado: ${type.name}`,
    updated: `Pagamento jurídico atualizado: ${type.name}`,
    deleted: `Pagamento jurídico removido: ${type.name}`,
    receipt: `Recibo jurídico gerado: ${type.name}`,
  };

  await recordClientTimelineEvent({
    companyId: context.companyId,
    clientId: payment.client_id,
    preSaleId: payment.pre_sale_id,
    eventType:
      action === "created"
        ? "legal_payment_created"
        : action === "updated"
          ? "legal_payment_updated"
          : action === "deleted"
            ? "legal_payment_deleted"
            : "legal_payment_receipt_generated",
    title: titles[action],
    note: payment.description || payment.notes,
    actorUserProfileId: context.userProfileId,
    actorRole: context.role,
    actorBusinessArea: context.businessArea,
    actor: context.profile,
    details: {
      payment_id: payment.id,
      payment_type: type.name,
      amount: payment.amount,
      goal_amount: payment.goal_amount,
      status: payment.status,
      due_date: payment.due_date,
      paid_at: payment.paid_at,
    },
  });
}

export async function createLegalPaymentAction(preSaleId: string, formData: FormData) {
  try {
    const context = await requireLegalPaymentContext(preSaleId);
    const responsible = await ensureLegalResponsibleUser(
      context,
      optionalUuid(formData.get("responsible_user_id")),
    );
    const type = await getLegalPaymentType(
      context,
      optionalUuid(formData.get("legal_payment_type_id")),
    );
    const payload = buildPayloadFromForm(formData, context, responsible.id);

    const { data, error } = await context.supabase
      .from("legal_payments")
      .insert({
        ...payload,
        legal_payment_type_id: type.id,
        created_by: context.userProfileId,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const payment = data as LegalPayment;
    await syncPaymentWithFinance({ payment, type, responsible, context });
    await recordLegalPaymentTimeline({ context, payment, type, action: "created" });
    await recordAuditLog({
      supabase: context.supabase,
      companyId: context.companyId,
      userProfileId: context.userProfileId,
      action: "legal_payment.created",
      entityType: "legal_payment",
      entityId: payment.id,
      entityLabel: type.name,
      details: payload,
    });

    revalidatePath(`/pre-vendas/${preSaleId}`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
  } catch (error) {
    redirectWithPaymentMessage(preSaleId, "error", normalizeError(error));
  }

  redirectWithPaymentMessage(preSaleId, "success", "Pagamento jurídico cadastrado.");
}

export async function updateLegalPaymentAction(paymentId: string, formData: FormData) {
  let preSaleId = normalizeText(formData.get("pre_sale_id")) ?? "";

  try {
    const context = await getCurrentUserContext();
    const current = await loadPaymentContext(paymentId, context);
    preSaleId = current.payment.pre_sale_id;
    const responsible = await ensureLegalResponsibleUser(
      context,
      optionalUuid(formData.get("responsible_user_id")),
    );
    const type = await getLegalPaymentType(
      context,
      optionalUuid(formData.get("legal_payment_type_id")),
    );
    const paymentContext = {
      ...context,
      preSale: current.preSale,
    };
    const payload = buildPayloadFromForm(formData, paymentContext, responsible.id);

    const { data, error } = await context.supabase
      .from("legal_payments")
      .update({
        ...payload,
        legal_payment_type_id: type.id,
      })
      .eq("id", paymentId)
      .eq("company_id", context.companyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const payment = data as LegalPayment;
    await syncPaymentWithFinance({ payment, type, responsible, context });
    await recordLegalPaymentTimeline({ context, payment, type, action: "updated" });
    await recordAuditLog({
      supabase: context.supabase,
      companyId: context.companyId,
      userProfileId: context.userProfileId,
      action: "legal_payment.updated",
      entityType: "legal_payment",
      entityId: payment.id,
      entityLabel: type.name,
      details: payload,
    });

    revalidatePath(`/pre-vendas/${preSaleId}`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
  } catch (error) {
    redirectWithPaymentMessage(preSaleId, "error", normalizeError(error));
  }

  redirectWithPaymentMessage(preSaleId, "success", "Pagamento jurídico atualizado.");
}

export async function deleteLegalPaymentAction(paymentId: string, formData: FormData) {
  let preSaleId = normalizeText(formData.get("pre_sale_id")) ?? "";

  try {
    const context = await getCurrentUserContext();
    const { payment } = await loadPaymentContext(paymentId, context);
    preSaleId = payment.pre_sale_id;
    const type = await getLegalPaymentType(context, payment.legal_payment_type_id);
    const adminClient = createAdminClient();

    if (payment.finance_transaction_id) {
      await adminClient
        .from("finance_transactions")
        .update({
          status: "canceled",
          amount_paid: null,
          paid_at: null,
          updated_by: context.userProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.finance_transaction_id)
        .eq("company_id", context.companyId);
    }

    if (payment.finance_sale_id) {
      await adminClient
        .from("finance_sales")
        .update({
          status: "canceled",
          updated_by: context.userProfileId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.finance_sale_id)
        .eq("company_id", context.companyId);
    }

    const { error } = await context.supabase
      .from("legal_payments")
      .delete()
      .eq("id", payment.id)
      .eq("company_id", context.companyId);

    if (error) {
      throw new Error(error.message);
    }

    await recordLegalPaymentTimeline({ context, payment, type, action: "deleted" });
    await recordAuditLog({
      supabase: context.supabase,
      companyId: context.companyId,
      userProfileId: context.userProfileId,
      action: "legal_payment.deleted",
      entityType: "legal_payment",
      entityId: payment.id,
      entityLabel: type.name,
    });

    revalidatePath(`/pre-vendas/${preSaleId}`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/consultas");
  } catch (error) {
    redirectWithPaymentMessage(preSaleId, "error", normalizeError(error));
  }

  redirectWithPaymentMessage(preSaleId, "success", "Pagamento jurídico removido.");
}

export async function generateLegalPaymentReceiptAction(
  paymentId: string,
  formData: FormData,
) {
  let preSaleId = normalizeText(formData.get("pre_sale_id")) ?? "";

  try {
    const context = await getCurrentUserContext();
    const { payment } = await loadPaymentContext(paymentId, context);
    preSaleId = payment.pre_sale_id;

    if (payment.status !== "pago") {
      throw new Error("O recibo jurídico só pode ser gerado para pagamento marcado como pago.");
    }

    const templateId = optionalUuid(formData.get("template_id"));

    if (!templateId) {
      throw new Error("Selecione o template do recibo jurídico.");
    }

    const { data: templateData, error: templateError } = await context.supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .eq("company_id", context.companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (templateError) {
      throw new Error(templateError.message);
    }

    const template = templateData as DocumentTemplate | null;

    if (!template) {
      throw new Error("Template ativo não encontrado.");
    }

    const result = template.original_pdf_path
      ? await generateOfficialPdfDocumentAction(payment.pre_sale_id, template.id, {
          legalPaymentId: payment.id,
        })
      : await generateOfficialDocumentAction(payment.pre_sale_id, template.id, {
          legalPaymentId: payment.id,
        });

    if (!result.ok || !result.documentId) {
      throw new Error(result.message);
    }

    const adminClient = createAdminClient();
    await adminClient
      .from("legal_payments")
      .update({
        receipt_generated_document_id: result.documentId,
        updated_by: context.userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("company_id", context.companyId);

    const type = await getLegalPaymentType(context, payment.legal_payment_type_id);
    await recordLegalPaymentTimeline({ context, payment, type, action: "receipt" });

    revalidatePath(`/pre-vendas/${preSaleId}`);
    revalidatePath("/documentos");
  } catch (error) {
    redirectWithPaymentMessage(preSaleId, "error", normalizeError(error));
  }

  redirectWithPaymentMessage(preSaleId, "success", "Recibo jurídico gerado.");
}
