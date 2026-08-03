import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { parseBrazilianDecimalInput } from "@/lib/calculations/currency";
import {
  assertPreSaleAccess,
  listAccessiblePreSaleIdsForCurrentUser,
} from "@/lib/pre-sales/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayName } from "@/lib/users/account";
import { formatPreSaleType } from "@/lib/pre-sales/formatters";
import type {
  CalculationClientOption,
  CalculationPreSaleOption,
  FinancingCalculation,
} from "@/types/calculation";

export const calculationReportsBucket = "calculation-reports";

type CurrentUserContext = Awaited<ReturnType<typeof getCurrentUserContext>>;

function getCompanyScopedClient(context: CurrentUserContext): SupabaseClient {
  if (context.isPlatformOwner) {
    return createAdminClient();
  }

  return context.supabase as SupabaseClient;
}

function normalizeNullableMoney(value: number | string | null | undefined) {
  const parsed = parseBrazilianDecimalInput(value);

  if (parsed === null || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function canManageCalculations(role: string | null) {
  return role === "admin" || role === "manager" || role === "seller";
}

export async function assertCalculationAccess(calculationId: string) {
  const context = await getCurrentUserContext();
  const { companyId, role, userProfileId } = context;
  const supabase = getCompanyScopedClient(context);

  if (!canManageCalculations(role)) {
    throw new Error("Você não tem permissão para acessar simulações.");
  }

  const { data, error } = await supabase
    .from("financing_calculations")
    .select("*")
    .eq("id", calculationId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const calculation = data as FinancingCalculation;

  if (role === "seller") {
    if (calculation.created_by === userProfileId) {
      return calculation;
    }

    if (calculation.pre_sale_id) {
      await assertPreSaleAccess(calculation.pre_sale_id);
      return calculation;
    }

    throw new Error("Você não tem permissão para acessar esta simulação.");
  }

  return calculation;
}

export async function assertClientBelongsToCompany(clientId: string, companyId: string) {
  const context = await getCurrentUserContext();
  const supabase = getCompanyScopedClient(context);
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Cliente não encontrado para esta empresa.");
  }
}

export async function assertPreSaleBelongsToCompany(
  preSaleId: string,
  companyId: string,
  clientId?: string | null,
) {
  const preSale = await assertPreSaleAccess(preSaleId);

  if (preSale.company_id !== companyId) {
    throw new Error("Pré-venda não encontrada para esta empresa.");
  }

  if (clientId && preSale.client_id !== clientId) {
    throw new Error("Pré-venda não encontrada para esta empresa.");
  }
}

export function buildCalculationReportPath(companyId: string, calculationId: string) {
  return `${companyId}/calculations/${calculationId}/simulacao-analise-de-correcao-de-juros.pdf`;
}

export function buildCalculationSummaryImagePath(
  companyId: string,
  calculationId: string,
) {
  return `${companyId}/calculations/${calculationId}/simulacao-resumida.png`;
}

function createSafeCalculationClientSlug(clientName: string) {
  return clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function createCalculationPdfFileName(clientName: string) {
  const safeName = createSafeCalculationClientSlug(clientName);

  return `simulacao-analise-de-correcao-de-juros-${safeName || randomUUID()}.pdf`;
}

export function createCalculationSummaryImageFileName(clientName: string) {
  const safeName = createSafeCalculationClientSlug(clientName);

  return `simulacao-resumida-${safeName || randomUUID()}.png`;
}

export async function listCalculationCreators(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return [];
  }

  const context = await getCurrentUserContext();
  const { companyId } = context;
  const supabase = getCompanyScopedClient(context);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, username, email")
    .eq("company_id", companyId)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    nickname: string | null;
    username: string | null;
    email: string | null;
  }>;
}

export async function listClientCalculations(clientId: string) {
  const context = await getCurrentUserContext();
  const { companyId, role, userProfileId } = context;
  const supabase = getCompanyScopedClient(context);

  if (!canManageCalculations(role)) {
    return [];
  }

  const { data, error } = await supabase
    .from("financing_calculations")
    .select(
      "id, financial_institution, financed_value, estimated_savings, status, created_at, created_by, pre_sale_id",
    )
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const calculations = (data ?? []) as FinancingCalculation[];

  if (role !== "seller") {
    return calculations;
  }

  const accessiblePreSaleIds = new Set(
    (await listAccessiblePreSaleIdsForCurrentUser()) ?? [],
  );

  return calculations.filter(
    (calculation) =>
      calculation.created_by === userProfileId ||
      (calculation.pre_sale_id ? accessiblePreSaleIds.has(calculation.pre_sale_id) : false),
  );
}

export async function listCalculationClients() {
  const context = await getCurrentUserContext();
  const { companyId } = context;
  const supabase = getCompanyScopedClient(context);
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, cpf, phone_mobile")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalculationClientOption[];
}

export async function listCalculationPreSales() {
  const context = await getCurrentUserContext();
  const { companyId, role, userProfileId } = context;
  const supabase = getCompanyScopedClient(context);
  let query = supabase
    .from("pre_sales")
    .select("id, client_id, consultant_user_id, created_by, pre_sale_type, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (role === "seller") {
    query = query.or(
      `consultant_user_id.eq.${userProfileId},created_by.eq.${userProfileId}`,
    );
  }

  const { data: preSalesData, error: preSalesError } = await query;

  if (preSalesError) {
    throw new Error(preSalesError.message);
  }

  const preSales = (preSalesData ?? []) as Array<{
    id: string;
    client_id: string;
    consultant_user_id: string | null;
    created_by: string;
    pre_sale_type: "emprestimo" | "imovel" | "veiculo";
    created_at: string;
  }>;
  const preSaleIds = preSales.map((item) => item.id);

  if (!preSaleIds.length) {
    return [];
  }

  const [
    { data: snapshotsData, error: snapshotsError },
    { data: financialCasesData, error: financialCasesError },
    { data: consultantsData, error: consultantsError },
  ] = await Promise.all([
    supabase
      .from("pre_sale_client_snapshot")
      .select("pre_sale_id, full_name, cpf, phone_mobile")
      .in("pre_sale_id", preSaleIds),
      supabase
      .from("pre_sale_financial_cases")
      .select(
        "pre_sale_id, financer_name, financed_amount, installment_amount, paid_installments, asset_brand_model, asset_year",
      )
      .in("pre_sale_id", preSaleIds),
    supabase
      .from("user_profiles")
      .select("id, full_name, nickname, username, email")
      .eq("company_id", companyId),
  ]);

  if (snapshotsError) {
    throw new Error(snapshotsError.message);
  }

  if (financialCasesError) {
    throw new Error(financialCasesError.message);
  }

  if (consultantsError) {
    throw new Error(consultantsError.message);
  }

  const snapshotMap = new Map(
    (snapshotsData ?? []).map((snapshot) => [snapshot.pre_sale_id, snapshot]),
  );
  const financialMap = new Map(
    (financialCasesData ?? []).map((item) => [item.pre_sale_id, item]),
  );
  const consultantMap = new Map(
    (consultantsData ?? []).map((user) => [
      user.id,
      resolveUserDisplayName(user, ""),
    ]),
  );

  return preSales.map((preSale) => {
    const snapshot = snapshotMap.get(preSale.id) as
      | {
          full_name: string | null;
          cpf: string | null;
          phone_mobile: string | null;
        }
      | undefined;
    const financial = financialMap.get(preSale.id) as
      | {
          financer_name: string | null;
          financed_amount: number | null;
          installment_amount: number | null;
          paid_installments: number | null;
          asset_brand_model: string | null;
          asset_year: string | number | null;
        }
      | undefined;
    const paidInstallments = Number(financial?.paid_installments ?? 0);

    return {
      id: preSale.id,
      client_id: preSale.client_id,
      pre_sale_type: preSale.pre_sale_type,
      label: `${snapshot?.full_name ?? "Cliente"} - ${formatPreSaleType(preSale.pre_sale_type)} - ${new Intl.DateTimeFormat(
        "pt-BR",
      ).format(new Date(preSale.created_at))}`,
      client_name: snapshot?.full_name ?? "",
      client_cpf: snapshot?.cpf ?? "",
      client_phone: snapshot?.phone_mobile ?? null,
      financial_institution: financial?.financer_name ?? null,
      specialist_name:
        (preSale.consultant_user_id
          ? (consultantMap.get(preSale.consultant_user_id) ?? null)
          : null) ??
        (consultantMap.get(preSale.created_by) ?? null),
      vehicle: financial?.asset_brand_model ?? null,
      vehicle_year:
        financial?.asset_year === null || financial?.asset_year === undefined
          ? null
          : String(financial.asset_year),
      financed_value: normalizeNullableMoney(financial?.financed_amount),
      down_payment: null,
      current_installment_value: normalizeNullableMoney(financial?.installment_amount),
      paid_installments: paidInstallments || null,
      remaining_installments: null,
    } satisfies CalculationPreSaleOption;
  });
}
