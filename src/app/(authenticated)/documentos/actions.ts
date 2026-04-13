"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { documentTemplateSchema } from "@/lib/documents/schema";
import { renderDocumentTemplate } from "@/lib/documents/template-engine";
import type { DocumentTemplatePayload } from "@/lib/documents/schema";
import type { DocumentTemplate } from "@/types/document";
import type {
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
} from "@/types/pre-sale";

export type DocumentActionState = {
  ok: boolean;
  message: string;
  content?: string;
};

function friendlyError(message: string): DocumentActionState {
  return {
    ok: false,
    message,
  };
}

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

async function getTemplate(templateId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", templateId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DocumentTemplate | null;
}

async function getDocumentContext(preSaleId: string, companyId: string) {
  const { supabase } = await getCurrentUserContext();
  const [
    { data: preSaleData, error: preSaleError },
    { data: snapshotData },
    { data: debtHolderData },
    { data: financialCaseData },
  ] = await Promise.all([
    supabase
      .from("pre_sales")
      .select("*")
      .eq("id", preSaleId)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("pre_sale_client_snapshot")
      .select("*")
      .eq("pre_sale_id", preSaleId)
      .maybeSingle(),
    supabase
      .from("pre_sale_debt_holders")
      .select("*")
      .eq("pre_sale_id", preSaleId)
      .maybeSingle(),
    supabase
      .from("pre_sale_financial_cases")
      .select("*")
      .eq("pre_sale_id", preSaleId)
      .maybeSingle(),
  ]);

  if (preSaleError) {
    throw preSaleError;
  }

  const preSale = preSaleData as PreSale | null;

  if (!preSale) {
    throw new Error("Pre-venda nao encontrada.");
  }

  return {
    preSale,
    snapshot: snapshotData as PreSaleClientSnapshot | null,
    debtHolder: debtHolderData as PreSaleDebtHolder | null,
    financialCase: financialCaseData as PreSaleFinancialCase | null,
  };
}

export async function createDocumentTemplateAction(
  values: DocumentTemplatePayload,
): Promise<DocumentActionState> {
  const parsed = documentTemplateSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos do template.");
  }

  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem criar templates.");
    }

    const { error } = await supabase.from("document_templates").insert({
      ...parsed.data,
      company_id: companyId,
      created_by: userProfileId,
    });

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  return {
    ok: true,
    message: "Template criado com sucesso.",
  };
}

export async function updateDocumentTemplateAction(
  templateId: string,
  values: DocumentTemplatePayload,
): Promise<DocumentActionState> {
  const parsed = documentTemplateSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos do template.");
  }

  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem editar templates.");
    }

    const { error } = await supabase
      .from("document_templates")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel editar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  redirect("/documentos/templates?success=updated");
}

export async function previewDocumentAction(
  preSaleId: string,
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { companyId } = await getCurrentUserContext();
    const [template, context] = await Promise.all([
      getTemplate(templateId, companyId),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    return {
      ok: true,
      message: "Preview gerado.",
      content: renderDocumentTemplate(template.content, context),
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar preview.",
    );
  }
}

export async function generateDocumentAction(
  preSaleId: string,
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const [template, context] = await Promise.all([
      getTemplate(templateId, companyId),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    const content = renderDocumentTemplate(template.content, context);
    const { error } = await supabase.from("generated_documents").insert({
      company_id: companyId,
      pre_sale_id: preSaleId,
      template_id: templateId,
      content,
      created_by: userProfileId,
    });

    if (error) {
      return friendlyError(error.message);
    }

    revalidatePath("/documentos");
    revalidatePath(`/pre-vendas/${preSaleId}`);
    return {
      ok: true,
      message: "Documento gerado com sucesso.",
      content,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar o documento.",
    );
  }
}
