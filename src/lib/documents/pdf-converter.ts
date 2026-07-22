import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export type PdfConversionResult =
  | {
      ok: true;
      pdfBuffer: Buffer;
      engine: "libreoffice";
    }
  | {
      ok: false;
      message: string;
      engine: "libreoffice";
    };

function runLibreOffice(inputPath: string, outputDir: string) {
  const binary = process.env.LIBREOFFICE_PATH || "libreoffice";

  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDir,
      inputPath,
    ]);
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

export async function convertDocxToPdf(
  docxBuffer: Buffer,
  filenameBase: string,
): Promise<PdfConversionResult> {
  const workDir = join(tmpdir(), `grscrm-documents-${randomUUID()}`);
  const safeBaseName = basename(filenameBase).replace(/[^\w.-]+/g, "-") || "documento";
  const inputPath = join(workDir, `${safeBaseName}.docx`);
  const outputPath = join(workDir, `${safeBaseName}.pdf`);

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(inputPath, docxBuffer);

    const result = await runLibreOffice(inputPath, workDir);

    if (result.code !== 0) {
      return {
        ok: false,
        engine: "libreoffice",
        message:
          result.stderr.trim() ||
          "LibreOffice não conseguiu converter o DOCX para PDF.",
      };
    }

    return {
      ok: true,
      engine: "libreoffice",
      pdfBuffer: await readFile(outputPath),
    };
  } catch (error) {
    return {
      ok: false,
      engine: "libreoffice",
      message:
        error instanceof Error
          ? error.message
          : "Conversão PDF indisponível neste ambiente.",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
