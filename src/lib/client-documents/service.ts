import { randomUUID } from "node:crypto";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { ClientDocument } from "@/types/client-document";

export const clientDocumentsBucket = "client-documents";
export const maxClientDocumentSize = 20 * 1024 * 1024;

const acceptedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "",
]);

const acceptedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
]);

export function canDeleteClientDocument(role: string | null) {
  return role === "admin" || role === "manager";
}

export function canModifyClientDocuments(
  role: string | null,
  businessArea: string | null,
) {
  return role === "admin" || role === "manager" || (role === "seller" && businessArea === "legal");
}

export function canManageClientDocuments(role: string | null) {
  return role === "admin" || role === "manager" || role === "seller";
}

export function isAllowedClientDocumentFile(file: Pick<File, "name" | "type">) {
  const lowerName = file.name.toLowerCase();
  const extension = Array.from(acceptedExtensions).find((value) => lowerName.endsWith(value));

  return Boolean(extension) && acceptedMimeTypes.has(file.type);
}

export function sanitizeClientDocumentFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "arquivo";
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
    throw new Error("Cliente não encontrado para esta empresa.");
  }
}

export async function assertPreSaleBelongsToClient(
  preSaleId: string,
  clientId: string,
  companyId: string,
) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("pre_sales")
    .select("id")
    .eq("id", preSaleId)
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Pré-venda não encontrada para este cliente.");
  }
}

export function buildClientDocumentPath(companyId: string, clientId: string, fileName: string) {
  const documentId = randomUUID();
  const safeName = sanitizeClientDocumentFileName(fileName);

  return {
    documentId,
    filePath: `${companyId}/${clientId}/${documentId}_${safeName}`,
  };
}

export async function listClientDocumentsByClient(clientId: string) {
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientDocument[];
}

export async function listClientDocumentsByPreSale(clientId: string, preSaleId: string) {
  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .eq("pre_sale_id", preSaleId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientDocument[];
}

export async function getClientDocumentWithAccess(documentId: string) {
  const { supabase, companyId, role } = await getCurrentUserContext();

  if (!canManageClientDocuments(role)) {
    throw new Error("Você não tem permissão para acessar documentos.");
  }

  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ClientDocument;
}

export async function listUploaderProfiles(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return [];
  }

  const { supabase, companyId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, username, email")
    .eq("company_id", companyId)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
  }>;
}
