"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import {
  assertPreSaleAccess,
  canCreatePreSales,
  canEditPreSaleRecord,
  canManageAllPreSales,
} from "@/lib/pre-sales/access";
import { preSaleFormSchema, type PreSalePayload } from "@/lib/pre-sales/schema";
import type { PreSaleStatus } from "@/types/pre-sale";

export type PreSaleActionState = {
  ok: boolean;
  message: string;
};

function friendlyError(message = "Nao foi possivel salvar a pre-venda.") {
  return {
    ok: false,
    message,
  };
}

function requireChangeNote(changeNote?: string | null) {
  const normalizedChangeNote = changeNote?.trim();
  return normalizedChangeNote ? normalizedChangeNote : null;
}

function getProtocolDateStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}${month}${day}`;
}

async function generateTrackingProtocol(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
) {
  const stamp = getProtocolDateStamp();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const protocol = `${stamp}${suffix}`;
    const { data, error } = await supabase
      .from("pre_sales")
      .select("id")
      .eq("tracking_protocol", protocol)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return protocol;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const protocol = `${stamp}${Date.now().toString().slice(-8)}${attempt}`;
    const { data, error } = await supabase
      .from("pre_sales")
      .select("id")
      .eq("tracking_protocol", protocol)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return protocol;
    }
  }

  throw new Error("Nao foi possivel gerar um protocolo numerico unico.");
}

function isTrackingProtocolConflict(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return error.code === "23505" || message.includes("tracking_protocol");
}

async function assertClientBelongsToCompany(clientId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("clients")
    .select("id, commercial_consultant_user_id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error && error.message.includes("commercial_consultant_user_id")) {
    const retry = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (retry.error) {
      throw retry.error;
    }

    return retry.data ? { id: retry.data.id as string, commercialConsultantUserId: null } : null;
  }

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id as string,
        commercialConsultantUserId:
          (data as { commercial_consultant_user_id?: string | null })
            .commercial_consultant_user_id ?? null,
      }
    : null;
}

async function assertClientExistsInCompany(clientId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("clients")
    .select("id, commercial_consultant_user_id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error && error.message.includes("commercial_consultant_user_id")) {
    const retry = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (retry.error) {
      throw retry.error;
    }

    return retry.data ? { id: retry.data.id as string, commercialConsultantUserId: null } : null;
  }

  if (error) {
    throw error;
  }

  return data
    ? {
        id: data.id as string,
        commercialConsultantUserId:
          (data as { commercial_consultant_user_id?: string | null })
            .commercial_consultant_user_id ?? null,
      }
    : null;
}

async function assertUserBelongsToCompany(userProfileId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", userProfileId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function splitPreSalePayload(values: PreSalePayload) {
  const {
    snapshot_full_name,
    snapshot_cpf,
    snapshot_rg,
    snapshot_birth_date,
    snapshot_marital_status,
    snapshot_profession,
    snapshot_email,
    snapshot_phone_mobile,
    snapshot_phone_secondary,
    snapshot_zip_code,
    snapshot_street,
    snapshot_number,
    snapshot_district,
    snapshot_city,
    snapshot_state,
    debt_holder_full_name,
    debt_holder_cpf,
    debt_holder_rg,
    debt_holder_birth_date,
    debt_holder_marital_status,
    debt_holder_profession,
    debt_holder_nationality,
    debt_holder_issuer_agency,
    debt_holder_father_name,
    debt_holder_mother_name,
    debt_holder_phone_mobile,
    debt_holder_phone_secondary,
    debt_holder_email,
    debt_holder_zip_code,
    debt_holder_street,
    debt_holder_number,
    debt_holder_district,
    debt_holder_city,
    debt_holder_state,
    financer_name,
    financer_legal_name,
    financer_cnpj,
    financer_address,
    financer_district,
    financer_zip_code,
    financer_city,
    financer_state,
    has_financing_contract,
    financed_amount,
    installment_amount,
    paid_installments,
    overdue_installments,
    due_day,
    contract_number,
    asset_brand_model,
    asset_color,
    asset_year,
    asset_plate,
    payments,
    ...preSaleValues
  } = values;
  const shouldKeepVehicleFields = values.pre_sale_type === "veiculo";

  return {
    preSaleValues,
    snapshotValues: {
      full_name: snapshot_full_name,
      cpf: snapshot_cpf,
      rg: snapshot_rg,
      birth_date: snapshot_birth_date,
      marital_status: snapshot_marital_status,
      profession: snapshot_profession,
      email: snapshot_email,
      phone_mobile: snapshot_phone_mobile,
      phone_secondary: snapshot_phone_secondary,
      zip_code: snapshot_zip_code,
      street: snapshot_street,
      number: snapshot_number,
      district: snapshot_district,
      city: snapshot_city,
      state: snapshot_state,
    },
    debtHolderValues: {
      full_name: debt_holder_full_name,
      cpf: debt_holder_cpf,
      rg: debt_holder_rg,
      birth_date: debt_holder_birth_date,
      marital_status: debt_holder_marital_status,
      profession: debt_holder_profession,
      nationality: debt_holder_nationality,
      issuer_agency: debt_holder_issuer_agency,
      father_name: debt_holder_father_name,
      mother_name: debt_holder_mother_name,
      phone_mobile: debt_holder_phone_mobile,
      phone_secondary: debt_holder_phone_secondary,
      email: debt_holder_email,
      zip_code: debt_holder_zip_code,
      street: debt_holder_street,
      number: debt_holder_number,
      district: debt_holder_district,
      city: debt_holder_city,
      state: debt_holder_state,
    },
    financialCaseValues: {
      financer_name,
      financer_legal_name,
      financer_cnpj,
      financer_address,
      financer_district,
      financer_zip_code,
      financer_city,
      financer_state,
      has_financing_contract,
      financed_amount,
      installment_amount,
      paid_installments,
      overdue_installments,
      due_day,
      contract_number,
      asset_brand_model: shouldKeepVehicleFields ? asset_brand_model : null,
      asset_color: shouldKeepVehicleFields ? asset_color : null,
      asset_year: shouldKeepVehicleFields ? asset_year : null,
      asset_plate: shouldKeepVehicleFields ? asset_plate : null,
    },
    payments: payments.filter((payment) =>
      Boolean(
        payment.amount !== null ||
          payment.goal_amount !== null ||
          payment.payment_method ||
          payment.payment_date,
      ),
    ),
  };
}

async function savePreSaleChildRecord(
  table: string,
  preSaleId: string,
  values: Record<string, unknown>,
  forceInsert = false,
) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from(table)
    .select("pre_sale_id")
    .eq("pre_sale_id", preSaleId)
    .maybeSingle();
  const existingCase = data as { pre_sale_id: string } | null;

  if (error) {
    throw error;
  }

  if (existingCase) {
    const { error: updateError } = await supabase
      .from(table)
      .update(values)
      .eq("pre_sale_id", existingCase.pre_sale_id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  if (
    !forceInsert &&
    !Object.values(values).some((value) => value !== null && value !== "")
  ) {
    return;
  }

  const { error: insertError } = await supabase
    .from(table)
    .insert({
      pre_sale_id: preSaleId,
      ...values,
    });

  if (insertError) {
    throw insertError;
  }
}

async function savePayments(
  preSaleId: string,
  payments: ReturnType<typeof splitPreSalePayload>["payments"],
) {
  const { supabase } = await getCurrentUserContext();
  const { error: deleteError } = await supabase
    .from("pre_sale_payments")
    .delete()
    .eq("pre_sale_id", preSaleId);

  if (deleteError) {
    throw deleteError;
  }

  if (!payments.length) {
    return;
  }

  const { error: insertError } = await supabase.from("pre_sale_payments").insert(
    payments.map((payment, index) => ({
      pre_sale_id: preSaleId,
      installment_number: payment.installment_number ?? index + 1,
      amount: payment.amount,
      goal_amount: payment.goal_amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      status: payment.status ?? "previsto",
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function createPreSaleAction(
  values: PreSalePayload,
  changeNote?: string | null,
): Promise<PreSaleActionState> {
  void changeNote;
  const parsed = preSaleFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios da pre-venda.");
  }

  let preSaleId = "";

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const {
      preSaleValues,
      snapshotValues,
      debtHolderValues,
      financialCaseValues,
      payments,
    } = splitPreSalePayload(parsed.data);
    const clientRecord = await assertClientBelongsToCompany(parsed.data.client_id, companyId);

    if (!clientRecord) {
      return friendlyError("Selecione um cliente ativo da empresa.");
    }

    if (parsed.data.consultant_user_id) {
      const consultantExists = await assertUserBelongsToCompany(
        parsed.data.consultant_user_id,
        companyId,
      );

      if (!consultantExists) {
        return friendlyError("Selecione um consultor da empresa.");
      }
    }

    if (!canCreatePreSales(role, businessArea)) {
      return friendlyError("O usuario atual nao pode criar pre-vendas nesta area.");
    }

    if (
      role === "seller" &&
      businessArea === "commercial" &&
      parsed.data.consultant_user_id &&
      parsed.data.consultant_user_id !== userProfileId
    ) {
      return friendlyError(
        "Consultores so podem criar pre-vendas vinculadas ao proprio usuario.",
      );
    }

    const consultantUserId =
      role === "seller" && businessArea === "commercial"
        ? userProfileId
        : parsed.data.consultant_user_id ||
          clientRecord.commercialConsultantUserId ||
          null;

    if (consultantUserId) {
      const consultantExists = await assertUserBelongsToCompany(consultantUserId, companyId);

      if (!consultantExists) {
        return friendlyError("Selecione um consultor da empresa.");
      }
    }

    let createdPreSale: { id: string } | null = null;
    let insertError: { code?: string | null; message?: string | null } | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const trackingProtocol = await generateTrackingProtocol(supabase);
      const { data, error } = await supabase
        .from("pre_sales")
        .insert({
          ...preSaleValues,
          consultant_user_id: consultantUserId,
          company_id: companyId,
          created_by: userProfileId,
          tracking_protocol: trackingProtocol,
        })
        .select("id")
        .single();

      if (!error) {
        createdPreSale = data as { id: string };
        insertError = null;
        break;
      }

      insertError = error;

      if (!isTrackingProtocolConflict(error)) {
        break;
      }
    }

    if (insertError || !createdPreSale) {
      return friendlyError(
        insertError?.message ?? "Nao foi possivel gerar um protocolo numerico unico.",
      );
    }

    preSaleId = createdPreSale.id;
    await savePreSaleChildRecord("pre_sale_client_snapshot", preSaleId, snapshotValues, true);
    await savePreSaleChildRecord("pre_sale_debt_holders", preSaleId, debtHolderValues, true);
    await savePreSaleChildRecord("pre_sale_financial_cases", preSaleId, financialCaseValues, true);
    await savePayments(preSaleId, payments);

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "pre_sale.created",
      entityType: "pre_sale",
      entityId: preSaleId,
      entityLabel: parsed.data.snapshot_full_name,
      details: {
        status: parsed.data.status,
        type: parsed.data.pre_sale_type,
        client_id: parsed.data.client_id,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId: parsed.data.client_id,
      preSaleId,
      eventType: "pre_sale_created",
      title: "Pre-venda criada",
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        status: parsed.data.status,
        type: parsed.data.pre_sale_type,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar a pre-venda.",
    );
  }

  revalidatePath("/pre-vendas");
  redirect(`/pre-vendas/${preSaleId}?success=created`);
}

export async function updatePreSaleAction(
  preSaleId: string,
  values: PreSalePayload,
  changeNote?: string | null,
): Promise<PreSaleActionState> {
  const parsed = preSaleFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios da pre-venda.");
  }

  const normalizedChangeNote = requireChangeNote(changeNote);

  if (!normalizedChangeNote) {
    return friendlyError("Descreva o que foi alterado na pre-venda e por que.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const {
      preSaleValues,
      snapshotValues,
      debtHolderValues,
      financialCaseValues,
      payments,
    } = splitPreSalePayload(parsed.data);
    const accessiblePreSale = await assertPreSaleAccess(preSaleId);

    if (!canEditPreSaleRecord(role, businessArea, userProfileId, accessiblePreSale)) {
      return friendlyError("O usuario atual nao pode editar esta pre-venda.");
    }

    const clientRecord = await assertClientExistsInCompany(parsed.data.client_id, companyId);

    if (!clientRecord) {
      return friendlyError("Selecione um cliente da empresa.");
    }

    if (
      role === "seller" &&
      businessArea === "commercial" &&
      parsed.data.consultant_user_id &&
      parsed.data.consultant_user_id !== userProfileId
    ) {
      return friendlyError(
        "Consultores so podem manter a pre-venda vinculada ao proprio usuario.",
      );
    }

    const consultantUserId =
      role === "seller" && businessArea === "commercial"
        ? userProfileId
        : parsed.data.consultant_user_id ||
          clientRecord.commercialConsultantUserId ||
          null;

    if (consultantUserId) {
      const consultantExists = await assertUserBelongsToCompany(consultantUserId, companyId);

      if (!consultantExists) {
        return friendlyError("Selecione um consultor da empresa.");
      }
    }

    const { error } = await supabase
      .from("pre_sales")
      .update({
        ...preSaleValues,
        consultant_user_id: consultantUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preSaleId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

      await savePreSaleChildRecord("pre_sale_client_snapshot", preSaleId, snapshotValues, true);
      await savePreSaleChildRecord("pre_sale_debt_holders", preSaleId, debtHolderValues, true);
      await savePreSaleChildRecord("pre_sale_financial_cases", preSaleId, financialCaseValues, true);
      await savePayments(preSaleId, payments);

      await recordAuditLog({
        supabase,
        companyId,
        userProfileId,
        action: "pre_sale.updated",
        entityType: "pre_sale",
        entityId: preSaleId,
        entityLabel: parsed.data.snapshot_full_name,
        details: {
          status: parsed.data.status,
          type: parsed.data.pre_sale_type,
          client_id: parsed.data.client_id,
        },
      });

      await recordClientTimelineEvent({
        companyId,
        clientId: parsed.data.client_id,
        preSaleId,
        eventType: "pre_sale_updated",
        title: "Pre-venda atualizada",
        note: normalizedChangeNote,
        actorUserProfileId: userProfileId,
        actorRole: role,
        actorBusinessArea: businessArea,
        actor: profile,
        details: {
          status: parsed.data.status,
          type: parsed.data.pre_sale_type,
        },
      });
    } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar a pre-venda.",
    );
  }

  revalidatePath("/pre-vendas");
  revalidatePath(`/pre-vendas/${preSaleId}`);
  redirect(`/pre-vendas/${preSaleId}?success=updated`);
}

export async function updatePreSaleStatusAction(
  preSaleId: string,
  status: PreSaleStatus,
  changeNote?: string | null,
): Promise<PreSaleActionState> {
  const normalizedChangeNote = requireChangeNote(changeNote);

  if (!normalizedChangeNote) {
    return friendlyError("Descreva a mudanca de status da pre-venda e o motivo.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const accessiblePreSale = await assertPreSaleAccess(preSaleId);
    const { data: currentPreSaleData, error: currentPreSaleError } = await supabase
      .from("pre_sales")
      .select("status")
      .eq("id", preSaleId)
      .eq("company_id", companyId)
      .single();

    if (currentPreSaleError || !currentPreSaleData) {
      return friendlyError("Pre-venda nao encontrada para atualizar o status.");
    }

    if (!canEditPreSaleRecord(role, businessArea, userProfileId, accessiblePreSale)) {
      return friendlyError("O usuario atual nao pode alterar o status desta pre-venda.");
    }

    const { error } = await supabase
      .from("pre_sales")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", preSaleId)
      .eq("company_id", companyId);

      if (error) {
        return friendlyError(error.message);
      }

      await recordAuditLog({
        supabase,
        companyId,
        userProfileId,
        action: "pre_sale.status_updated",
        entityType: "pre_sale",
        entityId: preSaleId,
        entityLabel: preSaleId,
        details: {
          status,
        },
      });

      await recordClientTimelineEvent({
        companyId,
        clientId: accessiblePreSale.client_id,
        preSaleId,
        eventType: "pre_sale_status_updated",
        title: `Status comercial movido para ${status}`,
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
    } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel alterar o status.",
    );
  }

  revalidatePath("/pre-vendas");
  revalidatePath(`/pre-vendas/${preSaleId}`);
  return {
    ok: true,
    message:
      status === "aprovado"
        ? "Pre-venda aprovada. Estrutura pronta para virar contrato futuramente."
        : "Status atualizado com sucesso.",
  };
}

export async function deletePreSaleAction(preSaleId: string): Promise<PreSaleActionState> {
  try {
      const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canManageAllPreSales(role)) {
      return friendlyError("Apenas admin ou manager podem excluir pre-vendas.");
    }

    const { error } = await supabase
      .from("pre_sales")
      .delete()
      .eq("id", preSaleId)
      .eq("company_id", companyId);

      if (error) {
        return friendlyError(error.message);
      }

      await recordAuditLog({
        supabase,
        companyId,
        userProfileId,
        action: "pre_sale.deleted",
        entityType: "pre_sale",
        entityId: preSaleId,
        entityLabel: preSaleId,
      });
    } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir a pre-venda.",
    );
  }

  revalidatePath("/pre-vendas");
  return {
    ok: true,
    message: "Pre-venda excluida com sucesso.",
  };
}
