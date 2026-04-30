"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
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

async function assertClientBelongsToCompany(clientId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function assertClientExistsInCompany(clientId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
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

async function canEditPreSale(preSaleId: string, companyId: string, userProfileId: string, role: string | null) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("pre_sales")
    .select("id, consultant_user_id")
    .eq("id", preSaleId)
    .eq("company_id", companyId)
    .maybeSingle();
  const preSale = data as { id: string; consultant_user_id: string | null } | null;

  if (error) {
    throw error;
  }

  if (!preSale) {
    return false;
  }

  if (role === "admin" || role === "manager") {
    return true;
  }

  return preSale.consultant_user_id === userProfileId;
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
      Object.values(payment).some((value) => value !== null && value !== ""),
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
): Promise<PreSaleActionState> {
  const parsed = preSaleFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios da pre-venda.");
  }

  let preSaleId = "";

  try {
    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const {
      preSaleValues,
      snapshotValues,
      debtHolderValues,
      financialCaseValues,
      payments,
    } = splitPreSalePayload(parsed.data);
    const clientExists = await assertClientBelongsToCompany(parsed.data.client_id, companyId);

    if (!clientExists) {
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

    const { data, error } = await supabase
      .from("pre_sales")
      .insert({
        ...preSaleValues,
        company_id: companyId,
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      return friendlyError(error.message);
    }

      preSaleId = (data as { id: string }).id;
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
): Promise<PreSaleActionState> {
  const parsed = preSaleFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios da pre-venda.");
  }

  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();
    const {
      preSaleValues,
      snapshotValues,
      debtHolderValues,
      financialCaseValues,
      payments,
    } = splitPreSalePayload(parsed.data);
    const canEdit = await canEditPreSale(preSaleId, companyId, userProfileId, role);

    if (!canEdit) {
      return friendlyError("Voce nao tem permissao para editar esta pre-venda.");
    }

    const clientExists = await assertClientExistsInCompany(parsed.data.client_id, companyId);

    if (!clientExists) {
      return friendlyError("Selecione um cliente da empresa.");
    }

    const { error } = await supabase
      .from("pre_sales")
      .update({
        ...preSaleValues,
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
): Promise<PreSaleActionState> {
  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();
    const canEdit = await canEditPreSale(preSaleId, companyId, userProfileId, role);

    if (!canEdit) {
      return friendlyError("Voce nao tem permissao para alterar esta pre-venda.");
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

    if (role !== "admin" && role !== "manager") {
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
