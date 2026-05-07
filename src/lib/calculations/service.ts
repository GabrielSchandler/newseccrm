import { randomUUID } from "node:crypto";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  assertPreSaleAccess,
  listAccessiblePreSaleIdsForCurrentUser,
} from "@/lib/pre-sales/access";
import { resolveUserDisplayName } from "@/lib/users/account";
import { formatPreSaleType } from "@/lib/pre-sales/formatters";
import type {
  CalculationClientOption,
  CalculationPreSaleOption,
  FinancingCalculation,
} from "@/types/calculation";

export const calculationReportsBucket = "calculation-reports";

export function canManageCalculations(role: string | null) {
  return role === "admin" || role === "manager" || role === "seller";
}

export async function assertCalculationAccess(calculationId: string) {
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

  if (!canManageCalculations(role)) {
    throw new Error("Voce nao tem permissao para acessar simulacoes.");
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

    throw new Error("Voce nao tem permissao para acessar esta simulacao.");
  }

  return calculation;
}

export async function assertClientBelongsToCompany(clientId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
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
    throw new Error("Cliente nao encontrado para esta empresa.");
  }
}

export async function assertPreSaleBelongsToCompany(
  preSaleId: string,
  companyId: string,
  clientId?: string | null,
) {
  const preSale = await assertPreSaleAccess(preSaleId);

  if (preSale.company_id !== companyId) {
    throw new Error("Pre-venda nao encontrada para esta empresa.");
  }

  if (clientId && preSale.client_id !== clientId) {
    throw new Error("Pre-venda nao encontrada para esta empresa.");
  }
}

export function buildCalculationReportPath(companyId: string, calculationId: string) {
  return `${companyId}/calculations/${calculationId}/simulacao-analise-de-correcao-de-juros.pdf`;
}

export function createCalculationPdfFileName(clientName: string) {
  const safeName = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `simulacao-analise-de-correcao-de-juros-${safeName || randomUUID()}.pdf`;
}

export async function listCalculationCreators(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return [];
  }

  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
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
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

  if (!canManageCalculations(role)) {
    return [];
  }

  const { data, error } = await supabase
    .from("financing_calculations")
    .select("*")
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
  const { supabase, companyId } = await getCurrentUserContext();
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
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();
  let query = supabase
    .from("pre_sales")
    .select("id, client_id, consultant_user_id, pre_sale_type, created_at")
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
        "pre_sale_id, financer_name, financed_amount, installment_amount, paid_installments, asset_year",
      )
      .in("pre_sale_id", preSaleIds),
    supabase
      .from("user_profiles")
      .select("*")
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
          asset_year: string | number | null;
        }
      | undefined;
    const paidInstallments = Number(financial?.paid_installments ?? 0);

    return {
      id: preSale.id,
      client_id: preSale.client_id,
      label: `${snapshot?.full_name ?? "Cliente"} - ${formatPreSaleType(preSale.pre_sale_type)} - ${new Intl.DateTimeFormat(
        "pt-BR",
      ).format(new Date(preSale.created_at))}`,
      client_name: snapshot?.full_name ?? "",
      client_cpf: snapshot?.cpf ?? "",
      client_phone: snapshot?.phone_mobile ?? null,
      financial_institution: financial?.financer_name ?? null,
      specialist_name: preSale.consultant_user_id
        ? (consultantMap.get(preSale.consultant_user_id) ?? null)
        : null,
      vehicle_year:
        financial?.asset_year === null || financial?.asset_year === undefined
          ? null
          : String(financial.asset_year),
      financed_value: financial?.financed_amount ?? null,
      down_payment: null,
      current_installment_value: financial?.installment_amount ?? null,
      paid_installments: paidInstallments || null,
      remaining_installments: null,
    } satisfies CalculationPreSaleOption;
  });
}
