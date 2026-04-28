import PizZip from "pizzip";

export type DocxStructureSummary = {
  imageCount: number;
  hasInlineImages: boolean;
  hasFloatingImages: boolean;
  hasHeaders: boolean;
  hasFooters: boolean;
  hasTextBoxes: boolean;
  hasShapeOrPict: boolean;
  hasWatermarkLikeElements: boolean;
  placeholders: string[];
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export function analyzeDocxStructure(templateBuffer: Buffer): DocxStructureSummary {
  const zip = new PizZip(templateBuffer);
  const wordFileNames = Object.keys(zip.files).filter((fileName) =>
    fileName.startsWith("word/"),
  );
  const xmlContents = wordFileNames
    .filter((fileName) => fileName.endsWith(".xml"))
    .map((fileName) => zip.file(fileName)?.asText() ?? "")
    .join("\n");
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";
  const mediaFiles = wordFileNames.filter((fileName) =>
    fileName.startsWith("word/media/"),
  );
  const placeholders = uniqueStrings(
    Array.from(xmlContents.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map(
      (match) => match[1],
    ),
  );

  return {
    imageCount: mediaFiles.length,
    hasInlineImages: documentXml.includes("<wp:inline"),
    hasFloatingImages: documentXml.includes("<wp:anchor"),
    hasHeaders: wordFileNames.some((fileName) => /word\/header\d+\.xml$/i.test(fileName)),
    hasFooters: wordFileNames.some((fileName) => /word\/footer\d+\.xml$/i.test(fileName)),
    hasTextBoxes:
      xmlContents.includes("<w:txbxContent") || xmlContents.includes("<wps:wsp"),
    hasShapeOrPict: xmlContents.includes("<w:pict") || xmlContents.includes("<v:shape"),
    hasWatermarkLikeElements:
      xmlContents.toLowerCase().includes("watermark") ||
      xmlContents.includes("behindDoc=\"1\"") ||
      xmlContents.includes("<v:shape"),
    placeholders,
  };
}
