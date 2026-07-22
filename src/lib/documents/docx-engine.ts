import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export type DocxRenderResult = {
  buffer: Buffer;
};

function normalizeVariables(variables: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, value ?? ""]),
  );
}

function buildDocxErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Não foi possível renderizar o DOCX oficial.";
  }

  const typedError = error as Error & {
    properties?: {
      errors?: Array<{
        properties?: {
          id?: string;
          explanation?: string;
          xtag?: string;
        };
      }>;
    };
  };
  const details = typedError.properties?.errors
    ?.map((item) =>
      [
        item.properties?.explanation,
        item.properties?.xtag ? `variável: ${item.properties.xtag}` : null,
      ]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean);

  if (details?.length) {
    return `Template DOCX inválido: ${details.join("; ")}`;
  }

  return error.message || "Não foi possível renderizar o DOCX oficial.";
}

export function renderOfficialDocxTemplate(
  templateBuffer: Buffer,
  variables: Record<string, string>,
): DocxRenderResult {
  try {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: "{{",
        end: "}}",
      },
      nullGetter: () => "",
    });

    doc.render(normalizeVariables(variables));

    return {
      buffer: doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      }) as Buffer,
    };
  } catch (error) {
    throw new Error(buildDocxErrorMessage(error));
  }
}
