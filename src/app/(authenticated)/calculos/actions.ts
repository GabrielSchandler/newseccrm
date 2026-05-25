"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
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

const documentsBucket = "documents";

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
  const isVehicleSimulation = values.simulation_type === "veiculo";
  const cashValue = parseBrazilianDecimalInput(values.cash_value);
  const downPayment = isVehicleSimulation
    ? parseBrazilianDecimalInput(values.down_payment)
    : 0;
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
  const isVehicleSimulation = values.simulation_type === "veiculo";
  const isImovelSimulation = values.simulation_type === "imovel";
  return {
    ...values,
    cash_value: parseBrazilianDecimalInput(values.cash_value),
    down_payment: isVehicleSimulation
      ? parseBrazilianDecimalInput(values.down_payment)
      : null,
    financed_value: parseBrazilianDecimalInput(values.financed_value),
    current_installment_value: parseBrazilianDecimalInput(
      values.current_installment_value,
    ),
    installment_reduction_percentage:
      parseBrazilianDecimalInput(values.installment_reduction_percentage) ?? 30,
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
    vehicle: isVehicleSimulation ? values.vehicle : null,
    vehicle_year: isVehicleSimulation ? values.vehicle_year : null,
    administrative_fee: isImovelSimulation
      ? parseBrazilianDecimalInput(values.administrative_fee)
      : null,
    insurance_value: isImovelSimulation
      ? parseBrazilianDecimalInput(values.insurance_value)
      : null,
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

function resolveCompanyFooterAddress(companyRecord: Record<string, unknown> | null) {
  if (!companyRecord) {
    return null;
  }

  const street = stringFromUnknown(companyRecord.street);
  const number = stringFromUnknown(companyRecord.number);
  const district = stringFromUnknown(companyRecord.district);
  const city = stringFromUnknown(companyRecord.city);
  const state = stringFromUnknown(companyRecord.state);

  const segments = [
    [street, number].filter(Boolean).join(", "),
    district,
    [city, state].filter(Boolean).join("/"),
  ].filter(Boolean);

  return segments.length ? segments.join(" • ") : null;
}

function isMissingProtocolColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42703" || message.includes("protocol_number");
}

function inferImageMimeType(filePath: string) {
  const normalizedPath = filePath.toLowerCase();

  if (normalizedPath.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedPath.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "image/png";
}

function getSaoPauloDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date).replace(/-/g, "");
}

async function resolveCompanyLogoDataUrl(logoPath: string | null | undefined) {
  if (!logoPath) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage.from(documentsBucket).download(logoPath);

  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return `data:${inferImageMimeType(logoPath)};base64,${buffer.toString("base64")}`;
}

async function buildFallbackProtocolNumber(companyId: string, supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"]) {
  const dateKey = getSaoPauloDateKey();
  const { count } = await supabase
    .from("financing_calculations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .not("pdf_storage_path", "is", null)
    .gte("updated_at", `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T00:00:00`)
    .lt("updated_at", `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T23:59:59.999`);

  return `${dateKey}${(count ?? 0) + 1}`;
}

async function ensureCalculationProtocolNumber(
  calculationId: string,
  companyId: string,
  existingProtocolNumber: string | null | undefined,
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
) {
  if (existingProtocolNumber?.trim()) {
    return existingProtocolNumber.trim();
  }

  const dateKey = getSaoPauloDateKey();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { count, error: countError } = await supabase
      .from("financing_calculations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .like("protocol_number", `${dateKey}%`);

    if (countError) {
      if (isMissingProtocolColumnError(countError)) {
        return buildFallbackProtocolNumber(companyId, supabase);
      }

      throw new Error(countError.message);
    }

    const candidate = `${dateKey}${(count ?? 0) + 1 + attempt}`;
    const { data, error: updateError } = await supabase
      .from("financing_calculations")
      .update({
        protocol_number: candidate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calculationId)
      .eq("company_id", companyId)
      .is("protocol_number", null)
      .select("protocol_number")
      .maybeSingle();

    if (!updateError) {
      const persisted = stringFromUnknown((data as { protocol_number?: string | null } | null)?.protocol_number);

      if (persisted) {
        return persisted;
      }

      const { data: existingData, error: existingError } = await supabase
        .from("financing_calculations")
        .select("protocol_number")
        .eq("id", calculationId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingError) {
        if (isMissingProtocolColumnError(existingError)) {
          return buildFallbackProtocolNumber(companyId, supabase);
        }

        throw new Error(existingError.message);
      }

      const existingProtocol = stringFromUnknown(
        (existingData as { protocol_number?: string | null } | null)?.protocol_number,
      );

      if (existingProtocol) {
        return existingProtocol;
      }

      continue;
    }

    if (isMissingProtocolColumnError(updateError)) {
      return buildFallbackProtocolNumber(companyId, supabase);
    }

    if (updateError.code === "23505") {
      continue;
    }

    throw new Error(updateError.message);
  }

  return buildFallbackProtocolNumber(companyId, supabase);
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
    const protocolNumber = await ensureCalculationProtocolNumber(
      calculationId,
      companyId,
      calculation.protocol_number,
      supabase,
    );
    const companyLogoSrc = await resolveCompanyLogoDataUrl(
      stringFromUnknown(companyRecord?.logo_path) || null,
    );
    const filePath = buildCalculationReportPath(companyId, calculationId);
    const pdfBuffer = await renderToBuffer(
      CalculationReportPdf({
        calculation,
        companyName: resolveCompanyDisplayName(companyRecord),
        companyDocument: stringFromUnknown(companyRecord?.cnpj) || null,
        companyLogoSrc,
        protocolNumber,
        companyPhone: stringFromUnknown(companyRecord?.phone) || null,
        companyWebsite: stringFromUnknown(companyRecord?.website) || null,
        companyAddress: resolveCompanyFooterAddress(companyRecord),
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
