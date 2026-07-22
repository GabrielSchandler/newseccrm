import { cache } from "react";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { CompanyBusinessArea } from "@/lib/workspace";
import type { PreSale } from "@/types/pre-sale";

type PreSaleAccessRecord = Pick<
  PreSale,
  "id" | "company_id" | "client_id" | "consultant_user_id" | "created_by"
>;

export function canManageAllPreSales(
  role: string | null,
) {
  return role === "admin" || role === "manager";
}

export function canAccessAllPreSales(
  role: string | null,
  businessArea?: CompanyBusinessArea,
) {
  return canManageAllPreSales(role) || (role === "seller" && businessArea === "legal");
}

export function canCreatePreSales(
  role: string | null,
  businessArea: CompanyBusinessArea,
) {
  return role === "admin" || role === "manager" || (role === "seller" && businessArea === "commercial");
}

export function canAccessPreSaleRecord(
  role: string | null,
  businessArea: CompanyBusinessArea,
  userProfileId: string,
  preSale: Pick<PreSaleAccessRecord, "consultant_user_id" | "created_by">,
) {
  if (canAccessAllPreSales(role, businessArea)) {
    return true;
  }

  if (role !== "seller") {
    return false;
  }

  return (
    preSale.consultant_user_id === userProfileId || preSale.created_by === userProfileId
  );
}

export function canEditPreSaleRecord(
  role: string | null,
  businessArea: CompanyBusinessArea,
  userProfileId: string,
  preSale: Pick<PreSaleAccessRecord, "consultant_user_id" | "created_by">,
) {
  if (canManageAllPreSales(role)) {
    return true;
  }

  if (role !== "seller" || businessArea !== "commercial") {
    return false;
  }

  return (
    preSale.consultant_user_id === userProfileId || preSale.created_by === userProfileId
  );
}

const assertPreSaleAccessCached = cache(async (preSaleId: string) => {
  const { supabase, companyId, role, businessArea, userProfileId } =
    await getCurrentUserContext();
  const { data, error } = await supabase
    .from("pre_sales")
    .select("id, company_id, client_id, consultant_user_id, created_by")
    .eq("id", preSaleId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Pré-venda não encontrada para esta empresa.");
  }

  const preSale = data as PreSaleAccessRecord;

  if (!canAccessPreSaleRecord(role, businessArea, userProfileId, preSale)) {
    throw new Error("Você não tem permissão para acessar esta pré-venda.");
  }

  return preSale;
});

export async function assertPreSaleAccess(preSaleId: string) {
  return assertPreSaleAccessCached(preSaleId);
}

const listAccessiblePreSaleIdsForCurrentUserCached = cache(async () => {
  const { supabase, companyId, role, businessArea, userProfileId } =
    await getCurrentUserContext();

  if (canAccessAllPreSales(role, businessArea)) {
    return null;
  }

  if (role !== "seller") {
    return [];
  }

  const { data, error } = await supabase
    .from("pre_sales")
    .select("id")
    .eq("company_id", companyId)
    .or(`consultant_user_id.eq.${userProfileId},created_by.eq.${userProfileId}`);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => item.id as string);
});

export async function listAccessiblePreSaleIdsForCurrentUser() {
  return listAccessiblePreSaleIdsForCurrentUserCached();
}
