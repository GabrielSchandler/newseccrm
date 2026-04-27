import { randomUUID } from "node:crypto";
import { getCurrentUserContext } from "@/lib/auth/current-user";
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
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageCalculations(role)) {
    throw new Error("Voce nao tem permissao para acessar calculos.");
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

  return data as FinancingCalculation;
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
  const { supabase } = await getCurrentUserContext();
  let query = supabase
    .from("pre_sales")
    .select("id, client_id")
    .eq("id", preSaleId)
    .eq("company_id", companyId);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Pre-venda nao encontrada para esta empresa.");
  }
}

export function buildCalculationReportPath(companyId: string, calculationId: string) {
  return `${companyId}/calculations/${calculationId}/analise-sintetizada.pdf`;
}

export function createCalculationPdfFileName(clientName: string) {
  const safeName = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `analise-sintetizada-${safeName || randomUUID()}.pdf`;
}

export async function listCalculationCreators(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return [];
  }

  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .eq("company_id", companyId)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
  }>;
}

export async function listClientCalculations(clientId: string) {
  const { supabase, companyId, role } = await getCurrentUserContext();

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

  return (data ?? []) as FinancingCalculation[];
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
  const { supabase, companyId } = await getCurrentUserContext();
  const { data: preSalesData, error: preSalesError } = await supabase
    .from("pre_sales")
    .select("id, client_id, consultant_user_id, pre_sale_type, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

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
        "pre_sale_id, financer_name, financed_amount, down_payment, installment_amount, installment_count, paid_installments, asset_brand_model, asset_year",
      )
      .in("pre_sale_id", preSaleIds),
    supabase
      .from("user_profiles")
      .select("id, full_name")
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
    (consultantsData ?? []).map((user) => [user.id, user.full_name ?? null]),
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
          down_payment: number | null;
          installment_amount: number | null;
          installment_count: number | null;
          paid_installments: number | null;
          asset_brand_model: string | null;
          asset_year: string | number | null;
        }
      | undefined;
    const installmentCount = Number(financial?.installment_count ?? 0);
    const paidInstallments = Number(financial?.paid_installments ?? 0);
    const remainingInstallments = Math.max(installmentCount - paidInstallments, 0);

    return {
      id: preSale.id,
      client_id: preSale.client_id,
      label: `${snapshot?.full_name ?? "Cliente"} - ${formatPreSaleType(preSale.pre_sale_type)} - ${new Intl.DateTimeFormat(
        "pt-BR",
      ).format(new Date(preSale.created_at))}`,
      client_name: snapshot?.full_name ?? "",
      client_cpf: snapshot?.cpf ?? "",
      client_phone: snapshot?.phone_mobile ?? null,
      financer_name: financial?.financer_name ?? null,
      specialist_name: preSale.consultant_user_id
        ? (consultantMap.get(preSale.consultant_user_id) ?? null)
        : null,
      vehicle: financial?.asset_brand_model ?? null,
      vehicle_year:
        financial?.asset_year === null || financial?.asset_year === undefined
          ? null
          : String(financial.asset_year),
      financed_value: financial?.financed_amount ?? null,
      down_payment: financial?.down_payment ?? null,
      current_installment_value: financial?.installment_amount ?? null,
      installment_count: installmentCount || null,
      paid_installments: paidInstallments || null,
      remaining_installments: remainingInstallments || null,
    } satisfies CalculationPreSaleOption;
  });
}
