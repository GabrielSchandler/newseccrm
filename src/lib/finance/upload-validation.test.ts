import { describe, expect, it } from "vitest";
import {
  financeUploadMaxBytes,
  validateFinanceUploadMetadata,
  validateFinanceUploadSignature,
} from "./upload-validation";

describe("finance upload validation", () => {
  it("accepts a valid XLSX upload", () => {
    const extension = validateFinanceUploadMetadata({
      name: "financeiro.xlsx",
      size: 1024,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(extension).toBe(".xlsx");
    expect(() =>
      validateFinanceUploadSignature(
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
        extension,
      ),
    ).not.toThrow();
  });

  it("rejects unsupported extensions and oversized files", () => {
    expect(() =>
      validateFinanceUploadMetadata({
        name: "arquivo.exe",
        size: 1024,
        type: "application/octet-stream",
      }),
    ).toThrow("Formato inválido");

    expect(() =>
      validateFinanceUploadMetadata({
        name: "financeiro.xlsx",
        size: financeUploadMaxBytes + 1,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).toThrow("20 MB");
  });

  it("rejects a file whose XLSX signature is invalid", () => {
    expect(() =>
      validateFinanceUploadSignature(Buffer.from("not a spreadsheet"), ".xlsx"),
    ).toThrow("XLSX está corrompido");
  });
});
