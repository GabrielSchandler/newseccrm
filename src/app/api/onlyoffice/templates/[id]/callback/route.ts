import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOnlyOfficeCallbackToken } from "@/lib/documents/onlyoffice";

type OnlyOfficeCallbackBody = {
  status?: number;
  url?: string;
};

const successResponse = NextResponse.json({ error: 0 });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, body] = await Promise.all([
      context.params,
      request.json() as Promise<OnlyOfficeCallbackBody>,
    ]);
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: 1, message: "Token ausente." }, { status: 401 });
    }

    const payload = verifyOnlyOfficeCallbackToken(token);

    if (payload.templateId !== id) {
      return NextResponse.json({ error: 1, message: "Template invalido." }, { status: 403 });
    }

    const status = body.status ?? 0;

    if (![2, 3, 6, 7].includes(status)) {
      return successResponse;
    }

    if (!body.url) {
      return NextResponse.json(
        { error: 1, message: "URL do documento nao recebida." },
        { status: 400 },
      );
    }

    const fileResponse = await fetch(body.url);

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 1, message: "Nao foi possivel baixar o DOCX editado." },
        { status: 502 },
      );
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const admin = createAdminClient();
    const uploadPath = payload.storagePath;
    const fileName = uploadPath.split("/").pop() || "template.docx";

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(uploadPath, fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 1, message: uploadError.message }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from("document_templates")
      .update({
        original_docx_path: uploadPath,
        original_docx_filename: fileName,
        original_docx_size: fileBuffer.byteLength,
        original_docx_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.templateId)
      .eq("company_id", payload.companyId);

    if (updateError) {
      return NextResponse.json({ error: 1, message: updateError.message }, { status: 500 });
    }

    revalidatePath("/documentos/templates");
    revalidatePath(`/documentos/templates/${payload.templateId}`);
    revalidatePath(`/documentos/templates/${payload.templateId}/editar`);

    return successResponse;
  } catch (error) {
    return NextResponse.json(
      {
        error: 1,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o DOCX editado pelo OnlyOffice.",
      },
      { status: 500 },
    );
  }
}
