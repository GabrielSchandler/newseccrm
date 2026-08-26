import path from "node:path";

export const financeUploadMaxBytes = 20 * 1024 * 1024;

const allowedMimeTypesByExtension: Record<string, Set<string>> = {
  ".csv": new Set([
    "application/csv",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
  ]),
  ".xls": new Set([
    "application/octet-stream",
    "application/vnd.ms-excel",
    "application/x-ole-storage",
  ]),
  ".xlsx": new Set([
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ]),
};

function getExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function validateFinanceUploadMetadata(file: {
  name: string;
  size: number;
  type?: string | null;
}) {
  const extension = getExtension(file.name);
  const allowedMimeTypes = allowedMimeTypesByExtension[extension];

  if (!allowedMimeTypes) {
    throw new Error("Formato inválido. Envie uma planilha XLSX, XLS ou CSV.");
  }

  if (file.size <= 0) {
    throw new Error("A planilha selecionada está vazia.");
  }

  if (file.size > financeUploadMaxBytes) {
    throw new Error("A planilha excede o limite de 20 MB por arquivo.");
  }

  const mimeType = file.type?.trim().toLowerCase();

  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new Error("O conteúdo informado não corresponde a uma planilha permitida.");
  }

  return extension;
}

export function validateFinanceUploadSignature(buffer: Buffer, extension: string) {
  if (extension === ".xlsx") {
    const isZipContainer =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (!isZipContainer) {
      throw new Error("O arquivo XLSX está corrompido ou possui formato incompatível.");
    }
  }

  if (extension === ".xls") {
    const compoundFileSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const isCompoundFile = compoundFileSignature.every(
      (byte, index) => buffer[index] === byte,
    );

    if (!isCompoundFile) {
      throw new Error("O arquivo XLS está corrompido ou possui formato incompatível.");
    }
  }
}
