"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  calculateFinancingRevision,
} from "@/lib/calculations/financing-calculation";
import { parseBrazilianDecimalInput } from "@/lib/calculations/currency";
import { CalculationReportPdf } from "@/lib/calculations/report-pdf";
import {
  financingCalculationFormSchema,
  type FinancingCalculationPayload,
} from "@/lib/calculations/schema";
import {
  assertCalculationAccess,
  assertClientBelongsToCompany,
  assertPreSaleBelongsToCompany,
  buildCalculationReportPath,
  calculationReportsBucket,
  canManageCalculations,
  createCalculationPdfFileName,
} from "@/lib/calculations/service";

export type CalculationActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
  url?: string;
};

function friendlyError(message: string): CalculationActionState {
  return {
    ok: false,
    message,
  };
}

function normalizeCalculationErrorMessage(message: string) {
  if (message.includes("Could not find the table") && message.includes("financing_calculations")) {
    return "A tabela public.financing_calculations ainda nao existe no Supabase desta instancia. Rode o SQL do modulo de simulacoes e tente novamente.";
  }

  return message;
}

async function ensureCalculationReportsBucketAvailable() {
  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase.storage
    .from(calculationReportsBucket)
    .list("", { limit: 1 });

  if (!error) {
    return null;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return friendlyError(
      "O bucket privado 'calculation-reports' ainda nao existe nesta instancia do Supabase.",
    );
  }

  return null;
}

function resolveFinancedValue(
  values: FinancingCalculationPayload,
  fallbackValue?: number | string | null,
) {
  const cashValue = parseBrazilianDecimalInput(values.cash_value);
  const downPayment = parseBrazilianDecimalInput(values.down_payment);
  const providedFinancedValue = parseBrazilianDecimalInput(
    values.financed_value ?? fallbackValue ?? null,
  );

  if (cashValue !== null && Number.isFinite(cashValue)) {
    return Math.max(cashValue - Math.max(downPayment ?? 0, 0), 0);
  }

  if (providedFinancedValue !== null && Number.isFinite(providedFinancedValue)) {
    return Math.max(providedFinancedValue, 0);
  }

  return null;
}

function resolveRemainingInstallments(values: FinancingCalculationPayload) {
  const rawInstallmentCount = String(values.installment_count ?? "").trim();
  const rawPaidInstallments = String(values.paid_installments ?? "").trim();

  if (!rawInstallmentCount && !rawPaidInstallments) {
    return null;
  }

  const installmentCount = Number(String(values.installment_count ?? "").replace(/\D/g, "")) || 0;
  const paidInstallments = Number(String(values.paid_installments ?? "").replace(/\D/g, "")) || 0;
  return Math.max(installmentCount - paidInstallments, 0);
}

function normalizeCalculationPayload(values: FinancingCalculationPayload) {
  return {
    ...values,
    cash_value: parseBrazilianDecimalInput(values.cash_value),
    down_payment: parseBrazilianDecimalInput(values.down_payment),
    financed_value: parseBrazilianDecimalInput(values.financed_value),
    current_installment_value: parseBrazilianDecimalInput(
      values.current_installment_value,
    ),
    installment_count:
      values.installment_count === null || values.installment_count === undefined
        ? null
        : Number(String(values.installment_count).replace(/\D/g, "")) || null,
    paid_installments:
      values.paid_installments === null || values.paid_installments === undefined
        ? null
        : Number(String(values.paid_installments).replace(/\D/g, "")) || null,
    remaining_installments:
      values.remaining_installments === null ||
      values.remaining_installments === undefined
        ? null
        : Number(String(values.remaining_installments).replace(/\D/g, "")) || null,
  };
}

function buildCalculationRecord(
  values: FinancingCalculationPayload,
  existingValues?: {
    financed_value?: number | string | null;
  },
) {
  const baseValues = normalizeCalculationPayload(values);
  const normalizedValues = {
    ...baseValues,
    financed_value: resolveFinancedValue(baseValues, existingValues?.financed_value),
    remaining_installments: resolveRemainingInstallments(baseValues),
  };
  const computed = calculateFinancingRevision(normalizedValues);

  return {
    ...normalizedValues,
    ...computed,
    status: "calculado" as const,
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveSpecialistName(
  nickname: string | null,
  fullName: string | null,
  username: string | null,
) {
  const normalizedNickname = nickname?.trim();

  if (normalizedNickname) {
    return normalizedNickname;
  }

  const normalizedFullName = fullName?.trim();

  if (normalizedFullName) {
    return normalizedFullName;
  }

  const normalizedUsername = username?.trim();

  if (normalizedUsername) {
    return normalizedUsername;
  }

  return "Nao informado";
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function resolveCalculationClientLabel(value: string | null | undefined) {
  return value?.trim() || "Nao informado";
}

function resolveCompanyDisplayName(companyRecord: Record<string, unknown> | null) {
  if (!companyRecord) {
    return "GRS CRM";
  }

  return (
    stringFromUnknown(companyRecord.trade_name) ||
    stringFromUnknown(companyRecord.legal_name) ||
    stringFromUnknown(companyRecord.nome_fantasia) ||
    stringFromUnknown(companyRecord.razao_social) ||
    "GRS CRM"
  );
}

async function revalidateCalculationPages(
  calculationId: string,
  clientId?: string | null,
  preSaleId?: string | null,
) {
  revalidatePath("/calculos");
  revalidatePath(`/calculos/${calculationId}`);
  revalidatePath(`/calculos/${calculationId}/editar`);

  if (clientId) {
    revalidatePath(`/clientes/${clientId}`);
  }

  if (preSaleId) {
    revalidatePath(`/pre-vendas/${preSaleId}`);
  }
}

export async function createFinancingCalculationAction(
  values: FinancingCalculationPayload,
): Promise<CalculationActionState> {
  const parsed = financingCalculationFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados da simulacao.");
  }

  try {
    const {
      supabase,
      companyId,
      userProfileId,
      role,
      nickname,
      fullName,
      username,
    } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return friendlyError("Voce nao tem permissao para criar simulacoes.");
    }

    if (parsed.data.client_id) {
      await assertClientBelongsToCompany(parsed.data.client_id, companyId);
    }

    if (parsed.data.pre_sale_id) {
      await assertPreSaleBelongsToCompany(
        parsed.data.pre_sale_id,
        companyId,
        parsed.data.client_id,
      );
    }

    const record = buildCalculationRecord({
      ...parsed.data,
      specialist_name: resolveSpecialistName(nickname, fullName, username),
      situation: "Aprovado",
      attendance_date: todayIsoDate(),
    });
    const { data, error } = await supabase
      .from("financing_calculations")
      .insert({
        ...record,
        company_id: companyId,
        created_by: userProfileId,
        updated_by: userProfileId,
      })
      .select("id")
      .single();

    if (error || !data) {
      return friendlyError(
        normalizeCalculationErrorMessage(
          error?.message || "Nao foi possivel salvar a simulacao.",
        ),
      );
    }

    const calculationId = (data as { id: string }).id;

    await revalidateCalculationPages(
      calculationId,
      parsed.data.client_id,
      parsed.data.pre_sale_id,
    );

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "calculation.created",
      entityType: "calculation",
      entityId: calculationId,
      entityLabel: resolveCalculationClientLabel(parsed.data.client_name),
      details: {
        client_id: parsed.data.client_id,
        pre_sale_id: parsed.data.pre_sale_id,
      },
    });

    return {
      ok: true,
      message: "Simulacao salva com sucesso.",
      redirectTo: `/calculos/${calculationId}?success=created`,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? normalizeCalculationErrorMessage(error.message)
        : "Nao foi possivel salvar a simulacao.",
    );
  }
}

export async function updateFinancingCalculationAction(
  calculationId: string,
  values: FinancingCalculationPayload,
): Promise<CalculationActionState> {
  const parsed = financingCalculationFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados da simulacao.");
  }

  try {
    const {
      supabase,
      companyId,
      userProfileId,
      role,
      nickname,
      fullName,
      username,
    } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return friendlyError("Voce nao tem permissao para editar simulacoes.");
    }

    const existing = await assertCalculationAccess(calculationId);

    if (parsed.data.client_id) {
      await assertClientBelongsToCompany(parsed.data.client_id, companyId);
    }

    if (parsed.data.pre_sale_id) {
      await assertPreSaleBelongsToCompany(
        parsed.data.pre_sale_id,
        companyId,
        parsed.data.client_id,
      );
    }

    const record = buildCalculationRecord({
      ...parsed.data,
      specialist_name: resolveSpecialistName(nickname, fullName, username),
      situation: "Aprovado",
      attendance_date: todayIsoDate(),
    }, {
      financed_value: existing.financed_value,
    });
    const { error } = await supabase
      .from("financing_calculations")
      .update({
        ...record,
        updated_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calculationId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(normalizeCalculationErrorMessage(error.message));
    }

    await revalidateCalculationPages(
      calculationId,
      parsed.data.client_id ?? existing.client_id,
      parsed.data.pre_sale_id ?? existing.pre_sale_id,
    );

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "calculation.updated",
      entityType: "calculation",
      entityId: calculationId,
      entityLabel: resolveCalculationClientLabel(parsed.data.client_name),
      details: {
        client_id: parsed.data.client_id ?? existing.client_id,
        pre_sale_id: parsed.data.pre_sale_id ?? existing.pre_sale_id,
      },
    });

    return {
      ok: true,
      message: "Simulacao atualizada com sucesso.",
      redirectTo: `/calculos/${calculationId}?success=updated`,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? normalizeCalculationErrorMessage(error.message)
        : "Nao foi possivel atualizar a simulacao.",
    );
  }
}

export async function deleteFinancingCalculationAction(
  calculationId: string,
): Promise<CalculationActionState> {
  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return friendlyError("Voce nao tem permissao para excluir simulacoes.");
    }

    const calculation = await assertCalculationAccess(calculationId);

    if (calculation.pdf_storage_path) {
      const { error: storageError } = await supabase.storage
        .from(calculationReportsBucket)
        .remove([calculation.pdf_storage_path]);

      if (
        storageError &&
        !storageError.message.toLowerCase().includes("not found")
      ) {
        return friendlyError(storageError.message);
      }
    }

    const { error } = await supabase
      .from("financing_calculations")
      .delete()
      .eq("id", calculationId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(normalizeCalculationErrorMessage(error.message));
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "calculation.deleted",
      entityType: "calculation",
      entityId: calculationId,
      entityLabel: resolveCalculationClientLabel(calculation.client_name),
      details: {
        client_id: calculation.client_id,
        pre_sale_id: calculation.pre_sale_id,
        pdf_storage_path: calculation.pdf_storage_path,
      },
    });

    await revalidateCalculationPages(
      calculationId,
      calculation.client_id,
      calculation.pre_sale_id,
    );

    return {
      ok: true,
      message: "Simulacao excluida com sucesso.",
      redirectTo: "/calculos?success=deleted",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? normalizeCalculationErrorMessage(error.message)
        : "Nao foi possivel excluir a simulacao.",
    );
  }
}

export async function generateCalculationPdfAction(
  calculationId: string,
): Promise<CalculationActionState> {
  try {
    const bucketError = await ensureCalculationReportsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageCalculations(role)) {
      return friendlyError("Voce nao tem permissao para gerar PDFs.");
    }

    const calculation = await assertCalculationAccess(calculationId);
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      return friendlyError(companyError.message);
    }

    const companyRecord = (companyData ?? null) as Record<string, unknown> | null;
    const filePath = buildCalculationReportPath(companyId, calculationId);
    const pdfBuffer = await renderToBuffer(
      CalculationReportPdf({
        calculation,
        companyName: resolveCompanyDisplayName(companyRecord),
        companyDocument: stringFromUnknown(companyRecord?.cnpj) || null,
      }),
    );
    const fileName =
      calculation.pdf_file_name ??
      createCalculationPdfFileName(resolveCalculationClientLabel(calculation.client_name));
    const { error: uploadError } = await supabase.storage
      .from(calculationReportsBucket)
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return friendlyError(uploadError.message);
    }

    const { error: updateError } = await supabase
      .from("financing_calculations")
      .update({
        pdf_storage_path: filePath,
        pdf_file_name: fileName,
        status: "pdf_gerado",
        updated_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calculationId)
      .eq("company_id", companyId);

    if (updateError) {
      return friendlyError(normalizeCalculationErrorMessage(updateError.message));
    }

    await revalidateCalculationPages(
      calculationId,
      calculation.client_id,
      calculation.pre_sale_id,
    );

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "calculation.pdf_generated",
      entityType: "calculation",
      entityId: calculationId,
      entityLabel: resolveCalculationClientLabel(calculation.client_name),
      details: {
        pdf_file_name: fileName,
      },
    });

    return {
      ok: true,
      message: "PDF gerado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar o PDF.",
    );
  }
}

export async function createSignedCalculationPdfUrlAction(
  calculationId: string,
  mode: "view" | "download" = "download",
): Promise<CalculationActionState> {
  try {
    const bucketError = await ensureCalculationReportsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const { supabase } = await getCurrentUserContext();
    const calculation = await assertCalculationAccess(calculationId);

    if (!calculation.pdf_storage_path) {
      return friendlyError("Esta simulacao ainda nao possui PDF gerado.");
    }

    const { data, error } = await supabase.storage
      .from(calculationReportsBucket)
      .createSignedUrl(
        calculation.pdf_storage_path,
        60 * 10,
        mode === "download"
          ? {
              download:
                calculation.pdf_file_name ??
                "simulacao-analise-de-correcao-de-juros.pdf",
            }
          : undefined,
      );

    if (error || !data?.signedUrl) {
      return friendlyError(error?.message || "Nao foi possivel gerar o link do PDF.");
    }

    return {
      ok: true,
      message: mode === "download" ? "Download liberado." : "Visualizacao liberada.",
      url: data.signedUrl,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel abrir o PDF.",
    );
  }
}
