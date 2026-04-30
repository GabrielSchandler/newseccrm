"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  assertClientBelongsToCompany,
  assertPreSaleBelongsToClient,
  buildClientDocumentPath,
  canDeleteClientDocument,
  canManageClientDocuments,
  clientDocumentsBucket,
  getClientDocumentWithAccess,
  isAllowedClientDocumentFile,
  maxClientDocumentSize,
} from "@/lib/client-documents/service";
import {
  clientDocumentUploadSchema,
  type ClientDocumentUploadPayload,
} from "@/lib/client-documents/schema";

export type ClientDocumentActionState = {
  ok: boolean;
  message: string;
  url?: string;
};

function friendlyError(message: string): ClientDocumentActionState {
  return {
    ok: false,
    message,
  };
}

async function ensureClientDocumentsBucketAvailable() {
  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase.storage.from(clientDocumentsBucket).list("", { limit: 1 });

  if (!error) {
    return null;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return friendlyError(
      "O bucket privado 'client-documents' ainda nao existe nesta instancia do Supabase.",
    );
  }

  return null;
}

export async function uploadClientDocumentAction(
  values: ClientDocumentUploadPayload,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const parsed = clientDocumentUploadSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados do documento.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return friendlyError("Selecione um arquivo.");
  }

  if (!isAllowedClientDocumentFile(file)) {
    return friendlyError(
      "Formato invalido. Envie PDF, JPG, PNG, WEBP, DOC ou DOCX.",
    );
  }

  if (file.size <= 0) {
    return friendlyError("O arquivo esta vazio.");
  }

  if (file.size > maxClientDocumentSize) {
    return friendlyError("Envie um arquivo com ate 10 MB.");
  }

  const { client_id: clientId, pre_sale_id: preSaleId } = parsed.data;

  try {
    const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

    if (!canManageClientDocuments(role)) {
      return friendlyError("Voce nao tem permissao para enviar documentos.");
    }

    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    await assertClientBelongsToCompany(clientId, companyId);

    if (preSaleId) {
      await assertPreSaleBelongsToClient(preSaleId, clientId, companyId);
    }

    const { documentId, filePath } = buildClientDocumentPath(companyId, clientId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(clientDocumentsBucket)
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return friendlyError(uploadError.message);
    }

    const { error: insertError } = await supabase.from("client_documents").insert({
      id: documentId,
      company_id: companyId,
      client_id: clientId,
      pre_sale_id: preSaleId,
      document_type: parsed.data.document_type,
      title: parsed.data.title,
      description: parsed.data.description,
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: userProfileId,
    });

    if (insertError) {
      await supabase.storage.from(clientDocumentsBucket).remove([filePath]);
      return friendlyError(insertError.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client_document.uploaded",
      entityType: "client_document",
      entityId: documentId,
      entityLabel: parsed.data.title || file.name,
      details: {
        client_id: clientId,
        pre_sale_id: preSaleId,
        document_type: parsed.data.document_type,
        file_name: file.name,
      },
    });

    revalidatePath(`/clientes/${clientId}`);

    if (preSaleId) {
      revalidatePath(`/pre-vendas/${preSaleId}`);
    }

    return {
      ok: true,
      message: "Documento enviado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel enviar o documento.",
    );
  }
}

export async function createSignedDocumentUrlAction(
  documentId: string,
  mode: "view" | "download" = "view",
): Promise<ClientDocumentActionState> {
  try {
    const { supabase } = await getCurrentUserContext();
    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const document = await getClientDocumentWithAccess(documentId);
    const { data, error } = await supabase.storage
      .from(clientDocumentsBucket)
      .createSignedUrl(document.file_path, 60 * 10, {
        download: mode === "download" ? document.file_name : false,
      });

    if (error || !data?.signedUrl) {
      return friendlyError(error?.message || "Nao foi possivel gerar o link do documento.");
    }

    return {
      ok: true,
      message: mode === "download" ? "Download liberado." : "Visualizacao liberada.",
      url: data.signedUrl,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel abrir o documento.",
    );
  }
}

export async function softDeleteClientDocumentAction(
  documentId: string,
): Promise<ClientDocumentActionState> {
  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canDeleteClientDocument(role)) {
      return friendlyError("Apenas admin ou gerente podem excluir documentos.");
    }

    const document = await getClientDocumentWithAccess(documentId);
    const { error } = await supabase
      .from("client_documents")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client_document.deleted",
      entityType: "client_document",
      entityId: documentId,
      entityLabel: document.title || document.file_name,
      details: {
        client_id: document.client_id,
        pre_sale_id: document.pre_sale_id,
      },
    });

    revalidatePath(`/clientes/${document.client_id}`);

    if (document.pre_sale_id) {
      revalidatePath(`/pre-vendas/${document.pre_sale_id}`);
    }

    return {
      ok: true,
      message: "Documento excluido.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir o documento.",
    );
  }
}
