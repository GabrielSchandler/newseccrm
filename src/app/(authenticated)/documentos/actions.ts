"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { renderOfficialDocxTemplate } from "@/lib/documents/docx-engine";
import { convertDocxToPdf } from "@/lib/documents/pdf-converter";
import { renderOfficialPdfFormTemplate } from "@/lib/documents/pdf-form-engine";
import { documentTemplateSchema } from "@/lib/documents/schema";
import {
  buildDocumentVariables,
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
  documentId?: string;
};

const docxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "",
]);
const documentsBucket = "documents";
const maxDocxSize = 15 * 1024 * 1024;
const maxPdfSize = 20 * 1024 * 1024;
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

function isValidDocxFile(file: File) {
  return file.name.toLowerCase().endsWith(".docx") && docxMimeTypes.has(file.type);
}

function isValidPdfFile(file: File) {
  return file.name.toLowerCase().endsWith(".pdf") && ["application/pdf", ""].includes(file.type);
}

function safeFileName(name: string) {
  const [baseName, extension = ""] = name.split(/\.([^.]+)$/);
  const safeBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${safeBase || "documento"}${extension ? `.${extension.toLowerCase()}` : ""}`;
}

function safeStorageName(name: string, extension: "docx" | "pdf") {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return `${safeFileName(withoutExtension)}.${extension}`;
}

function storagePath(parts: string[]) {
  return parts.map((part) => part.replace(/^\/+|\/+$/g, "")).join("/");
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
      "img",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      b: "strong",
      i: "em",
      img: sanitizeHtml.simpleTransform("img", {
        loading: "lazy",
      }),
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
    disallowedTagsMode: "discard",
  });

  return normalizeHtmlSpacing(restorePlaceholders(sanitized, placeholders));
}

const officialTemplateColumns = [
  "original_docx_path",
  "original_docx_filename",
  "original_docx_size",
  "original_docx_uploaded_at",
  "original_pdf_path",
  "original_pdf_filename",
  "original_pdf_size",
  "original_pdf_uploaded_at",
] as const;

const officialGeneratedDocumentColumns = [
  "generated_docx_path",
  "generated_pdf_path",
  "generated_docx_filename",
  "generated_pdf_filename",
  "render_source",
  "pdf_error_message",
] as const;

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.message?.toLowerCase().includes("column") || false;
}

async function ensureOfficialDocumentSchema(
  options: { requireTemplateColumns?: boolean; requireGeneratedColumns?: boolean } = {},
) {
  const { supabase } = await getCurrentUserContext();

  if (options.requireTemplateColumns) {
    const { error } = await supabase
      .from("document_templates")
      .select(officialTemplateColumns.join(","))
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) {
        return friendlyError(
          "Esta instancia ainda nao recebeu as colunas oficiais de documentos. Rode o SQL docs/sql/documentos-docx-oficial.sql no Supabase antes de usar DOCX/PDF oficial.",
        );
      }

      return friendlyError(error.message);
    }
  }

  if (options.requireGeneratedColumns) {
    const { error } = await supabase
      .from("generated_documents")
      .select(officialGeneratedDocumentColumns.join(","))
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) {
        return friendlyError(
          "A tabela generated_documents desta instancia ainda nao possui as colunas de arquivo oficial. Rode o SQL docs/sql/documentos-docx-oficial.sql no Supabase antes de gerar documentos oficiais.",
        );
      }

      return friendlyError(error.message);
    }
  }

  return null;
}

async function ensureDocumentsBucketAvailable() {
  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase.storage.from(documentsBucket).list("", { limit: 1 });

  if (!error) {
    return null;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return friendlyError(
      "O bucket privado 'documents' ainda nao existe nesta instancia. Crie-o no Supabase Storage antes de usar os arquivos oficiais.",
    );
  }

  return null;
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

function buildTemplateWritePayload(values: DocumentTemplatePayload) {
  return {
    ...values,
    type: values.document_type,
    content: values.content_html,
  };
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
        ...buildTemplateWritePayload(parsed.data),
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
        ...buildTemplateWritePayload(parsed.data),
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
      type: template.document_type,
      description: template.description,
      content_html: template.content_html,
      content: template.content_html,
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

export async function uploadOfficialDocxTemplateAction(
  templateId: string,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem substituir o DOCX oficial.");
    }

    const schemaError = await ensureOfficialDocumentSchema({
      requireTemplateColumns: true,
    });

    if (schemaError) {
      return schemaError;
    }

    const bucketError = await ensureDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const template = await getTemplate(templateId, companyId);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return friendlyError("Selecione um arquivo DOCX.");
    }

    if (!isValidDocxFile(file)) {
      return friendlyError("Formato nao suportado. Envie um arquivo .docx.");
    }

    if (file.size <= 0) {
      return friendlyError("O arquivo DOCX esta vazio.");
    }

    if (file.size > maxDocxSize) {
      return friendlyError("Envie um DOCX com ate 15 MB.");
    }

    const filename = safeFileName(file.name);
    const path = storagePath([
      companyId,
      "templates",
      templateId,
      `${Date.now()}-${filename}`,
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(documentsBucket)
      .upload(path, buffer, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return friendlyError(uploadError.message);
    }

    const { error: updateError } = await supabase
      .from("document_templates")
      .update({
        original_docx_path: path,
        original_docx_filename: filename,
        original_docx_size: file.size,
        original_docx_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (updateError) {
      return friendlyError(updateError.message);
    }

    revalidatePath("/documentos/templates");
    revalidatePath(`/documentos/templates/${templateId}`);
    revalidatePath(`/documentos/templates/${templateId}/editar`);

    return {
      ok: true,
      message: "DOCX oficial vinculado ao template.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel vincular o DOCX oficial.",
    );
  }
}

export async function uploadOfficialPdfTemplateAction(
  templateId: string,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const { supabase, companyId, role } = await getCurrentUserContext();

    if (!canManageTemplates(role)) {
      return friendlyError("Apenas admin ou gerente podem substituir o PDF oficial.");
    }

    const schemaError = await ensureOfficialDocumentSchema({
      requireTemplateColumns: true,
    });

    if (schemaError) {
      return schemaError;
    }

    const bucketError = await ensureDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const template = await getTemplate(templateId, companyId);

    if (!template) {
      return friendlyError("Template nao encontrado.");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return friendlyError("Selecione um arquivo PDF.");
    }

    if (!isValidPdfFile(file)) {
      return friendlyError("Formato nao suportado. Envie um arquivo .pdf.");
    }

    if (file.size <= 0) {
      return friendlyError("O arquivo PDF esta vazio.");
    }

    if (file.size > maxPdfSize) {
      return friendlyError("Envie um PDF com ate 20 MB.");
    }

    const filename = safeFileName(file.name);
    const path = storagePath([
      companyId,
      "templates",
      templateId,
      `${Date.now()}-${filename}`,
    ]);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(documentsBucket)
      .upload(path, buffer, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return friendlyError(uploadError.message);
    }

    const { error: updateError } = await supabase
      .from("document_templates")
      .update({
        original_pdf_path: path,
        original_pdf_filename: filename,
        original_pdf_size: file.size,
        original_pdf_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("company_id", companyId);

    if (updateError) {
      return friendlyError(updateError.message);
    }

    revalidatePath("/documentos/templates");
    revalidatePath(`/documentos/templates/${templateId}`);
    revalidatePath(`/documentos/templates/${templateId}/editar`);

    return {
      ok: true,
      message: "PDF oficial vinculado ao template.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel vincular o PDF oficial.",
    );
  }
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

async function uploadGeneratedFile(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
  path: string,
  buffer: Buffer,
  contentType: string,
) {
  const { error } = await supabase.storage.from(documentsBucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function generateOfficialDocumentAction(
  preSaleId: string,
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const schemaError = await ensureOfficialDocumentSchema({
      requireTemplateColumns: true,
      requireGeneratedColumns: true,
    });

    if (schemaError) {
      return schemaError;
    }

    const bucketError = await ensureDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const [template, context] = await Promise.all([
      getTemplate(templateId, companyId, true),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template ativo nao encontrado.");
    }

    if (!template.original_docx_path) {
      return friendlyError(
        "Este template ainda nao possui DOCX oficial. Vincule um DOCX no cadastro do template.",
      );
    }

    const { data: storedDocx, error: downloadError } = await supabase.storage
      .from(documentsBucket)
      .download(template.original_docx_path);

    if (downloadError || !storedDocx) {
      return friendlyError(
        downloadError?.message || "Nao foi possivel baixar o DOCX oficial.",
      );
    }

    const variables = buildDocumentVariables(context);
    const officialDocx = renderOfficialDocxTemplate(
      Buffer.from(await storedDocx.arrayBuffer()),
      variables,
    );
    const renderedHtml = template.content_html
      ? renderDocumentTemplate(template.content_html, context).content
      : "";
    const title = buildDocumentTitle(template, {
      content: renderedHtml,
      variables,
    });
    const fileBase = safeStorageName(title, "docx").replace(/\.docx$/, "");
    const documentFolder = storagePath([
      companyId,
      "pre_sales",
      preSaleId,
      "documents",
      `${Date.now()}-${safeFileName(template.name)}`,
    ]);
    const generatedDocxFilename = `${fileBase}.docx`;
    const generatedPdfFilename = `${fileBase}.pdf`;
    const generatedDocxPath = storagePath([documentFolder, generatedDocxFilename]);
    const generatedPdfPath = storagePath([documentFolder, generatedPdfFilename]);

    await uploadGeneratedFile(
      supabase,
      generatedDocxPath,
      officialDocx.buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const pdfResult = await convertDocxToPdf(officialDocx.buffer, fileBase);
    let pdfErrorMessage: string | null = null;
    let savedPdfPath: string | null = null;
    let savedPdfFilename: string | null = null;

    if (pdfResult.ok) {
      await uploadGeneratedFile(
        supabase,
        generatedPdfPath,
        pdfResult.pdfBuffer,
        "application/pdf",
      );
      savedPdfPath = generatedPdfPath;
      savedPdfFilename = generatedPdfFilename;
    } else {
      pdfErrorMessage =
        `${pdfResult.message}. O DOCX foi gerado e salvo; configure LibreOffice ` +
        "ou um servico externo para finalizar o PDF neste ambiente.";
      console.error("[documents] PDF conversion failed", {
        preSaleId,
        templateId,
        message: pdfResult.message,
      });
    }

    const { data, error } = await supabase
      .from("generated_documents")
      .insert({
        company_id: companyId,
        pre_sale_id: preSaleId,
        client_id: context.preSale.client_id,
        template_id: templateId,
        document_type: template.document_type,
        title,
        rendered_content_html: renderedHtml,
        rendered_variables: variables,
        generated_docx_path: generatedDocxPath,
        generated_pdf_path: savedPdfPath,
        generated_docx_filename: generatedDocxFilename,
        generated_pdf_filename: savedPdfFilename,
        render_source: "docx",
        pdf_error_message: pdfErrorMessage,
        status: "gerado",
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      return friendlyError(error.message);
    }

    revalidatePath("/documentos");
    revalidatePath(`/pre-vendas/${preSaleId}`);

    return {
      ok: true,
      message: pdfResult.ok
        ? "Documento oficial gerado em DOCX e PDF."
        : "DOCX oficial gerado. PDF ficou pendente porque o conversor nao esta disponivel.",
      content: renderedHtml,
      variables,
      documentId: (data as { id: string }).id,
    };
  } catch (error) {
    console.error("[documents] Official document generation failed", {
      preSaleId,
      templateId,
      error,
    });

    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel gerar o documento oficial.",
    );
  }
}

export async function generateOfficialPdfDocumentAction(
  preSaleId: string,
  templateId: string,
): Promise<DocumentActionState> {
  try {
    const schemaError = await ensureOfficialDocumentSchema({
      requireTemplateColumns: true,
      requireGeneratedColumns: true,
    });

    if (schemaError) {
      return schemaError;
    }

    const bucketError = await ensureDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const [template, context] = await Promise.all([
      getTemplate(templateId, companyId, true),
      getDocumentContext(preSaleId, companyId),
    ]);

    if (!template) {
      return friendlyError("Template ativo nao encontrado.");
    }

    if (!template.original_pdf_path) {
      return friendlyError("Este template ainda nao possui PDF oficial.");
    }

    const { data: storedPdf, error: downloadError } = await supabase.storage
      .from(documentsBucket)
      .download(template.original_pdf_path);

    if (downloadError || !storedPdf) {
      return friendlyError(
        downloadError?.message || "Nao foi possivel baixar o PDF oficial.",
      );
    }

    const variables = buildDocumentVariables(context);
    const renderedPdf = await renderOfficialPdfFormTemplate(
      Buffer.from(await storedPdf.arrayBuffer()),
      variables,
    );

    if (!renderedPdf.filledFields.length) {
      return friendlyError(
        "O PDF oficial nao possui campos preenchiveis com nomes iguais as variaveis. Crie campos como cliente_nome, cliente_cpf ou contratante_nome no PDF.",
      );
    }

    const renderedHtml = template.content_html
      ? renderDocumentTemplate(template.content_html, context).content
      : "";
    const title = buildDocumentTitle(template, {
      content: renderedHtml,
      variables,
    });
    const fileBase = safeStorageName(title, "pdf").replace(/\.pdf$/, "");
    const generatedPdfFilename = `${fileBase}.pdf`;
    const documentFolder = storagePath([
      companyId,
      "pre_sales",
      preSaleId,
      "documents",
      `${Date.now()}-${safeFileName(template.name)}`,
    ]);
    const generatedPdfPath = storagePath([documentFolder, generatedPdfFilename]);

    await uploadGeneratedFile(
      supabase,
      generatedPdfPath,
      renderedPdf.buffer,
      "application/pdf",
    );

    const { data, error } = await supabase
      .from("generated_documents")
      .insert({
        company_id: companyId,
        pre_sale_id: preSaleId,
        client_id: context.preSale.client_id,
        template_id: templateId,
        document_type: template.document_type,
        title,
        rendered_content_html: renderedHtml,
        rendered_variables: variables,
        generated_docx_path: null,
        generated_pdf_path: generatedPdfPath,
        generated_docx_filename: null,
        generated_pdf_filename: generatedPdfFilename,
        render_source: "pdf",
        pdf_error_message: null,
        status: "gerado",
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      return friendlyError(error.message);
    }

    revalidatePath("/documentos");
    revalidatePath(`/pre-vendas/${preSaleId}`);

    return {
      ok: true,
      message: `PDF oficial gerado com ${renderedPdf.filledFields.length} campos preenchidos.`,
      content: renderedHtml,
      variables,
      documentId: (data as { id: string }).id,
    };
  } catch (error) {
    console.error("[documents] Official PDF document generation failed", {
      preSaleId,
      templateId,
      error,
    });

    return friendlyError(
      error instanceof Error
        ? error.message
        : "Nao foi possivel gerar o PDF oficial.",
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
    const { data, error } = await supabase
      .from("generated_documents")
      .insert({
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
      })
      .select("id")
      .single();

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
      documentId: (data as { id: string }).id,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel gerar o documento.",
    );
  }
}
