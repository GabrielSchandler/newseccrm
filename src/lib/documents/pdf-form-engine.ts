import { PDFDocument } from "pdf-lib";

export type PdfFormRenderResult = {
  buffer: Buffer;
  filledFields: string[];
  missingFields: string[];
};

export async function renderOfficialPdfFormTemplate(
  templateBuffer: Buffer,
  variables: Record<string, string>,
): Promise<PdfFormRenderResult> {
  const pdf = await PDFDocument.load(templateBuffer, {
    ignoreEncryption: true,
  });
  const form = pdf.getForm();
  const fields = form.getFields();
  const availableFieldNames = new Set(fields.map((field) => field.getName()));
  const filledFields: string[] = [];
  const missingFields: string[] = [];

  for (const [key, value] of Object.entries(variables)) {
    if (!availableFieldNames.has(key)) {
      missingFields.push(key);
      continue;
    }

    const field = form.getField(key);

    if ("setText" in field && typeof field.setText === "function") {
      field.setText(value ?? "");
      filledFields.push(key);
    }
  }

  form.updateFieldAppearances();
  form.flatten();

  return {
    buffer: Buffer.from(await pdf.save()),
    filledFields,
    missingFields,
  };
}
