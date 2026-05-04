import { getCurrentUserContext } from "@/lib/auth/current-user";
import { assertPreSaleAccess } from "@/lib/pre-sales/access";
import type { GeneratedDocument } from "@/types/document";

export async function assertGeneratedDocumentAccess(documentId: string) {
  const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Documento gerado nao encontrado.");
  }

  const document = data as GeneratedDocument;

  if (role === "seller") {
    if (document.created_by === userProfileId) {
      return document;
    }

    if (document.pre_sale_id) {
      await assertPreSaleAccess(document.pre_sale_id);
      return document;
    }

    throw new Error("Voce nao tem permissao para acessar este documento.");
  }

  return document;
}
