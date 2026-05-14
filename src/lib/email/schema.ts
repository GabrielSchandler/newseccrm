import { z } from "zod";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const emailTemplateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do template."),
  legal_stage: optionalText,
  recipient_mode: z.enum(["client", "bank", "client_bank", "custom"]),
  subject_template: z.string().trim().min(1, "Informe o assunto."),
  body_template: z.string().trim().min(1, "Informe o corpo do email."),
  cc_template: optionalText,
  bcc_template: optionalText,
});

export type EmailTemplatePayload = z.output<typeof emailTemplateSchema>;
