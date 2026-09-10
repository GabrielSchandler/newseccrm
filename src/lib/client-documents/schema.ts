import { z } from "zod";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const clientDocumentUploadSchema = z.object({
  client_id: z.string().uuid("Cliente inválido."),
  pre_sale_id: z
    .union([z.string().uuid("Pré-venda inválida."), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
  document_type: z.enum(
    [
      "documentacao",
      "extrajudicial",
      "processual",
    ],
    {
      required_error: "Selecione o tipo do documento.",
      invalid_type_error: "Selecione o tipo do documento.",
    },
  ),
  title: optionalText,
  description: optionalText,
  client_visibility_requested: z.boolean().default(false),
  client_download_requested: z.boolean().default(false),
});

export type ClientDocumentUploadFormValues = z.input<typeof clientDocumentUploadSchema>;
export type ClientDocumentUploadPayload = z.output<typeof clientDocumentUploadSchema>;
export const clientDocumentUpdateSchema = clientDocumentUploadSchema.pick({
  pre_sale_id: true,
  document_type: true,
  title: true,
  description: true,
  client_visibility_requested: true,
  client_download_requested: true,
});
export type ClientDocumentUpdatePayload = z.output<typeof clientDocumentUpdateSchema>;

export const clientDocumentUploadDefaultValues: ClientDocumentUploadFormValues = {
  client_id: "",
  pre_sale_id: "",
  document_type: "documentacao",
  title: "",
  description: "",
  client_visibility_requested: false,
  client_download_requested: false,
};
