"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    asset_brand_model,
    asset_color,
    asset_year,
    asset_plate,
    ...preSaleValues
  } = values;
  const shouldKeepVehicleFields = values.pre_sale_type === "veiculo";

  return {
    preSaleValues,
    financialCaseValues: {
      asset_brand_model: shouldKeepVehicleFields ? asset_brand_model : null,
      asset_color: shouldKeepVehicleFields ? asset_color : null,
      asset_year: shouldKeepVehicleFields ? asset_year : null,
      asset_plate: shouldKeepVehicleFields ? asset_plate : null,
    },
  };
}

async function saveFinancialCase(
  preSaleId: string,
  companyId: string,
  values: ReturnType<typeof splitPreSalePayload>["financialCaseValues"],
) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("pre_sale_financial_cases")
    .select("pre_sale_id")
    .eq("pre_sale_id", preSaleId)
    .maybeSingle();
  const existingCase = data as { pre_sale_id: string } | null;

  if (error) {
    throw error;
  }

  if (existingCase) {
    const { error: updateError } = await supabase
      .from("pre_sale_financial_cases")
      .update(values)
      .eq("pre_sale_id", existingCase.pre_sale_id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const hasVehicleValues = Object.values(values).some(Boolean);

  if (!hasVehicleValues) {
    return;
  }

  const { error: insertError } = await supabase
    .from("pre_sale_financial_cases")
    .insert({
      pre_sale_id: preSaleId,
      company_id: companyId,
      ...values,
    });

  if (insertError) {
    if (
      insertError.message.toLowerCase().includes("company_id") &&
      insertError.message.toLowerCase().includes("column")
    ) {
      const { error: retryError } = await supabase
        .from("pre_sale_financial_cases")
        .insert({
          pre_sale_id: preSaleId,
          ...values,
        });

      if (!retryError) {
        return;
      }
    }

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
    const { preSaleValues, financialCaseValues } = splitPreSalePayload(parsed.data);
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
    await saveFinancialCase(preSaleId, companyId, financialCaseValues);
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
    const { preSaleValues, financialCaseValues } = splitPreSalePayload(parsed.data);
    const canEdit = await canEditPreSale(preSaleId, companyId, userProfileId, role);

    if (!canEdit) {
      return friendlyError("Voce nao tem permissao para editar esta pre-venda.");
    }

    const clientExists = await assertClientBelongsToCompany(parsed.data.client_id, companyId);

    if (!clientExists) {
      return friendlyError("Selecione um cliente ativo da empresa.");
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

    await saveFinancialCase(preSaleId, companyId, financialCaseValues);
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
    const { supabase, companyId, role } = await getCurrentUserContext();

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
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir a pre-venda.",
    );
  }

  revalidatePath("/pre-vendas");
  redirect("/pre-vendas?success=deleted");
}
