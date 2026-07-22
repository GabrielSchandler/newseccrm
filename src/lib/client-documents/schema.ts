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
      "rg",
      "cpf",
      "cnh",
      "comprovante_residencia",
      "contrato_assinado",
      "procuracao",
      "documento_financiamento",
      "outro",
    ],
    {
      required_error: "Selecione o tipo do documento.",
      invalid_type_error: "Selecione o tipo do documento.",
    },
  ),
  title: optionalText,
  description: optionalText,
});

export type ClientDocumentUploadFormValues = z.input<typeof clientDocumentUploadSchema>;
export type ClientDocumentUploadPayload = z.output<typeof clientDocumentUploadSchema>;
export const clientDocumentUpdateSchema = clientDocumentUploadSchema.pick({
  document_type: true,
  title: true,
  description: true,
});
export type ClientDocumentUpdatePayload = z.output<typeof clientDocumentUpdateSchema>;

export const clientDocumentUploadDefaultValues: ClientDocumentUploadFormValues = {
  client_id: "",
  pre_sale_id: "",
  document_type: "rg",
  title: "",
  description: "",
};
