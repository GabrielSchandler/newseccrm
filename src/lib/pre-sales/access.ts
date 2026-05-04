import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { PreSale } from "@/types/pre-sale";

type PreSaleAccessRecord = Pick<
  PreSale,
  "id" | "company_id" | "client_id" | "consultant_user_id" | "created_by"
>;

export function canManageAllPreSales(role: string | null) {
  return role === "admin" || role === "manager";
}

export function canAccessPreSaleRecord(
  role: string | null,
  userProfileId: string,
  preSale: Pick<PreSaleAccessRecord, "consultant_user_id" | "created_by">,
) {
  if (canManageAllPreSales(role)) {
    return true;
  }

  if (role !== "seller") {
    return false;
  }

  return (
    preSale.consultant_user_id === userProfileId || preSale.created_by === userProfileId
  );
}

export async function assertPreSaleAccess(preSaleId: string) {
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();
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
    throw new Error("Pre-venda nao encontrada para esta empresa.");
  }

  const preSale = data as PreSaleAccessRecord;

  if (!canAccessPreSaleRecord(role, userProfileId, preSale)) {
    throw new Error("Voce nao tem permissao para acessar esta pre-venda.");
  }

  return preSale;
}

export async function listAccessiblePreSaleIdsForCurrentUser() {
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

  if (canManageAllPreSales(role)) {
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
}
