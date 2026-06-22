import { z } from "zod";

export const defaultDocumentTemplateContentHtml =
  "<p>Documento oficial vinculado em DOCX ou PDF.</p>";

export const documentTemplateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do template."),
  document_type: z.enum(
    ["ordem_servico", "contrato", "aditivo", "declaracao", "procuracao", "outro"],
    {
      required_error: "Selecione o tipo do documento.",
      invalid_type_error: "Selecione o tipo do documento.",
    },
  ),
  description: z.string().trim().nullable().optional(),
  legal_stage: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional(),
  content_html: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || defaultDocumentTemplateContentHtml),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export type DocumentTemplateFormValues = z.input<typeof documentTemplateSchema>;
export type DocumentTemplatePayload = z.output<typeof documentTemplateSchema>;
