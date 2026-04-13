import { z } from "zod";

export const documentTemplateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do template."),
  type: z.enum(["contrato", "ordem_servico"], {
    required_error: "Selecione o tipo do template.",
    invalid_type_error: "Selecione o tipo do template.",
  }),
  content: z.string().trim().min(1, "Informe o conteudo do template."),
});

export type DocumentTemplatePayload = z.output<typeof documentTemplateSchema>;
