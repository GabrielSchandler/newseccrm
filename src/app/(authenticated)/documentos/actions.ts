"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { documentTemplateSchema } from "@/lib/documents/schema";
import {
  renderDocumentTemplate,
  type RenderedDocument,
} from "@/lib/documents/template-engine";
import type { DocumentTemplatePayload } from "@/lib/documents/schema";
import type {
  DocumentTemplate,
  DocumentTemplateType,
} from "@/types/document";
import type { Client } from "@/types/client";
import type {
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
  PreSalePayment,
  UserProfileOption,
} from "@/types/pre-sale";

export type DocumentActionState = {
  ok: boolean;
  message: string;
  content?: string;
  variables?: Record<string, string>;
};

const docxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "",
]);
const docxStyleMap = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Titulo'] => h1:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Cabeçalho 1'] => h1:fresh",
  "p[style-name='Cabeçalho 2'] => h2:fresh",
  "p[style-name='Cabeçalho 3'] => h3:fresh",
  "p[style-name='Normal'] => p:fresh",
];

function friendlyError(message: string): DocumentActionState {
  return {
    ok: false,
    message,
  };
}

function canManageTemplates(role: string | null) {
  return role === "admin" || role === "manager";
}

function normalizeDocxPlaceholders(html: string) {
  return html.replace(/\{\{([\s\S]{0,160}?)\}\}/g, (match, rawInner: string) => {
    const inner = rawInner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, "")
      .trim();

    if (/^[a-zA-Z0-9_]+$/.test(inner)) {
      return `{{${inner}}}`;
    }

    return match;
  });
}

function protectPlaceholders(html: string) {
  const placeholders: string[] = [];
  const htmlWithTokens = html.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match: string) => {
      const token = `DOCX_PLACEHOLDER_${placeholders.length}_TOKEN`;
      placeholders.push(match.replace(/\s+/g, ""));
      return token;
    },
  );

  return { htmlWithTokens, placeholders };
}

function restorePlaceholders(html: string, placeholders: string[]) {
  return placeholders.reduce(
    (content, placeholder, index) =>
      content.replaceAll(`DOCX_PLACEHOLDER_${index}_TOKEN`, placeholder),
    html,
  );
}

function normalizeHtmlSpacing(html: string) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/(<\/(?:p|h[1-6]|li|tr|table|ul|ol)>)\s*(<(?:p|h[1-6]|ul|ol|table))/gi, "$1\n$2")
    .trim();
}

function extractPlainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanImportedDocxHtml(html: string) {
  const normalizedPlaceholders = normalizeDocxPlaceholders(html);
  const { htmlWithTokens, placeholders } = protectPlaceholders(normalizedPlaceholders);
  const sanitized = sanitizeHtml(htmlWithTokens, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      b: "strong",
      i: "em",
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
    disallowedTagsMode: "discard",
  });

  return normalizeHtmlSpacing(restorePlaceholders(sanitized, placeholders));
}

async function getTemplate(templateId: string, companyId: string, onlyActive = false) {
  const { supabase } = await getCurrentUserContext();
  let query = supabase
    .from("document_templates")
    .select("*")
    .eq("id", templateId)
    .eq("company_id", companyId);

  if (onlyActive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.maybeSingle();

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
    { data: paymentsData },
    { data: companyData },
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
    supabase
      .from("pre_sale_payments")
      .select("*")
      .eq("pre_sale_id", preSaleId)
      .order("installment_number", { ascending: true }),
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
  ]);

  if (preSaleError) {
    throw preSaleError;
  }

  const preSale = preSaleData as PreSale | null;

  if (!preSale) {
    throw new Error("Pre-venda nao encontrada.");
  }

  const [{ data: clientData }, { data: consultantData }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", preSale.client_id)
      .eq("company_id", companyId)
      .maybeSingle(),
    preSale.consultant_user_id
      ? supabase
          .from("user_profiles")
          .select("id, full_name, email, role")
          .eq("id", preSale.consultant_user_id)
          .eq("company_id", companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    preSale,
    client: clientData as Client | null,
    snapshot: snapshotData as PreSaleClientSnapshot | null,
    debtHolder: debtHolderData as PreSaleDebtHolder | null,
    financialCase: financialCaseData as PreSaleFinancialCase | null,
    payments: (paymentsData ?? []) as PreSalePayment[],
    company: companyData as Record<string, unknown> | null,
    consultant: consultantData as UserProfileOption | null,
  };
}

function buildDocumentTitle(
  template: DocumentTemplate,
  rendered: RenderedDocument,
) {
  const clientName =
    rendered.variables.contratante_nome || rendered.variables.cliente_nome || "cliente";
  const date = new Intl.DateTimeFormat("pt-BR").format(new Date());
  return `${template.name} - ${clientName} - ${date}`;
}

async function ensureDefaultTemplateState(
  companyId: string,
  templateType: DocumentTemplateType,
  templateId: string,
  isDefault: boolean,
) {
  if (!isDefault) {
    return;
  }

  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase
    .from("document_templates")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("document_type", templateType)
    .neq("id", templateId);

  if (error) {
    throw error;
  }
}

export async function createDocumentTemplateAction(
  values: DocumentTemplatePayload,
): Promise<DocumentActionState> {
  const parsed = documentTemplateSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos do template.");
  }

  let templateId = "";

  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem criar templates.");
    }

    const { data, error } = await supabase
      .from("document_templates")
      .insert({
        ...parsed.data,
        company_id: companyId,
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      return friendlyError(error.message);
    }

    templateId = (data as { id: string }).id;
    await ensureDefaultTemplateState(
      companyId,
      parsed.data.document_type,
      templateId,
      parsed.data.is_default,
    );
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  redirect(`/documentos/templates/${templateId}`);
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

    await ensureDefaultTemplateState(
      companyId,
      parsed.data.document_type,
      templateId,
      parsed.data.is_default,
    );
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel editar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  redirect(`/documentos/templates/${templateId}?success=updated`);
}

export async function toggleDocumentTemplateActiveAction(
  templateId: string,
  isActive: boolean,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem ativar templates.");
    }

    const updateValues = isActive
      ? {
          is_active: true,
          updated_at: new Date().toISOString(),
        }
      : {
          is_active: false,
          is_default: false,
          updated_at: new Date().toISOString(),
        };

    const { error } = await supabase
      .from("document_templates")
      .update(updateValues)
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  return {
    ok: true,
    message: isActive ? "Template ativado." : "Template desativado.",
  };
}

export async function setDefaultDocumentTemplateAction(
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem definir template padrao.");
    }

    const template = await getTemplate(templateId, companyId);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    await ensureDefaultTemplateState(companyId, template.document_type, template.id, true);

    const { error } = await supabase
      .from("document_templates")
      .update({
        is_default: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel definir o padrao.",
    );
  }

  revalidatePath("/documentos/templates");
  return {
    ok: true,
    message: "Template marcado como padrao.",
  };
}

export async function duplicateDocumentTemplateAction(
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem duplicar templates.");
    }

    const template = await getTemplate(templateId, companyId);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    const { error } = await supabase.from("document_templates").insert({
      company_id: companyId,
      name: `${template.name} (copia)`,
      document_type: template.document_type,
      description: template.description,
      content_html: template.content_html,
      is_active: false,
      is_default: false,
      created_by: userProfileId,
    });

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel duplicar o template.",
    );
  }

  revalidatePath("/documentos/templates");
  return {
    ok: true,
    message: "Template duplicado como inativo.",
  };
}

export async function deleteDocumentTemplateAction(
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem excluir templates.");
    }

    const { count, error: countError } = await supabase
      .from("generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId)
      .eq("company_id", companyId);

    if (countError) {
      return friendlyError(countError.message);
    }

    if ((count ?? 0) > 0) {
      return friendlyError(
        "Este template ja gerou documentos. Desative-o para preservar o historico.",
      );
    }

    const { error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir o template.",
    );
  }

  revalidatePath("/documentos/templates");
  return {
    ok: true,
    message: "Template excluido com sucesso.",
  };
}

export async function importDocxTemplateAction(
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const { role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem importar DOCX.");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return friendlyError("Selecione um arquivo DOCX.");
    }

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".docx") || !docxMimeTypes.has(file.type)) {
      return friendlyError("Formato nao suportado. Envie um arquivo .docx.");
    }

    if (file.size <= 0) {
      return friendlyError("O arquivo DOCX esta vazio.");
    }

    if (file.size > 10 * 1024 * 1024) {
      return friendlyError("Envie um DOCX com ate 10 MB.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
      {
        buffer: Buffer.from(arrayBuffer),
      },
      {
        styleMap: docxStyleMap,
        includeDefaultStyleMap: true,
      },
    );
    const contentHtml = cleanImportedDocxHtml(result.value);
    const plainText = extractPlainText(contentHtml);

    if (!contentHtml || !plainText) {
      return friendlyError("Nao foi possivel extrair HTML deste DOCX.");
    }

    return {
      ok: true,
      message: result.messages.length || plainText.length < 40
        ? "Revise a formatacao importada antes de salvar."
        : "DOCX convertido com sucesso.",
      content: contentHtml,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel converter o DOCX.",
    );
  }
}

export async function previewDocumentAction(
  preSaleId: string,
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const { companyId } = await getCurrentUserContext();
    const [template, context] = await Promise.all([
      getTemplate(templateId, companyId, true),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template ativo nao encontrado.");
    }

    const rendered = renderDocumentTemplate(template.content_html, context);
    return {
      ok: true,
      message: "Preview gerado.",
      content: rendered.content,
      variables: rendered.variables,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar preview.",
    );
  }
}

export async function previewTemplateContentAction(
  preSaleId: string,
  contentHtml: string,
): Promise<DocumentActionState> {
  if (!contentHtml.trim()) {
    return friendlyError("Informe o conteudo do template antes do preview.");
  }

  try {
    const { companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem visualizar preview.");
    }

    const context = await getDocumentContext(preSaleId, companyId);
    const rendered = renderDocumentTemplate(contentHtml, context);

    return {
      ok: true,
      message: "Preview gerado.",
      content: rendered.content,
      variables: rendered.variables,
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
      getTemplate(templateId, companyId, true),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template ativo nao encontrado.");
    }

    const rendered = renderDocumentTemplate(template.content_html, context);
    const { error } = await supabase.from("generated_documents").insert({
      company_id: companyId,
      pre_sale_id: preSaleId,
      client_id: context.preSale.client_id,
      template_id: templateId,
      document_type: template.document_type,
      title: buildDocumentTitle(template, rendered),
      rendered_content_html: rendered.content,
      rendered_variables: rendered.variables,
      status: "gerado",
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
      content: rendered.content,
      variables: rendered.variables,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar o documento.",
    );
  }
}
