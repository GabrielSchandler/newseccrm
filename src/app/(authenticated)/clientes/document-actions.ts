"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertClientBelongsToCompany,
  assertPreSaleBelongsToClient,
  buildClientDocumentPath,
  canModifyClientDocuments,
  canManageClientDocuments,
  clientDocumentsBucket,
  getClientDocumentWithAccess,
  isAllowedClientDocumentFile,
  maxClientDocumentSize,
} from "@/lib/client-documents/service";
import {
  clientDocumentUploadSchema,
  clientDocumentUpdateSchema,
  type ClientDocumentUpdatePayload,
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
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.storage
    .from(clientDocumentsBucket)
    .list("", { limit: 1 });

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
    const adminSupabase = createAdminClient();

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
    const { error: uploadError } = await adminSupabase.storage
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
      await adminSupabase.storage.from(clientDocumentsBucket).remove([filePath]);
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
    const adminSupabase = createAdminClient();
    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const document = await getClientDocumentWithAccess(documentId);
    const { data, error } = await adminSupabase.storage
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

export async function updateClientDocumentAction(
  documentId: string,
  values: ClientDocumentUpdatePayload,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const parsed = clientDocumentUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados do documento.");
  }

  const replacementFile = formData.get("file");

  if (replacementFile && !(replacementFile instanceof File)) {
    return friendlyError("Arquivo invalido para substituicao.");
  }

  if (replacementFile instanceof File && replacementFile.size > 0) {
    if (!isAllowedClientDocumentFile(replacementFile)) {
      return friendlyError("Formato invalido. Envie PDF, JPG, PNG, WEBP, DOC ou DOCX.");
    }

    if (replacementFile.size > maxClientDocumentSize) {
      return friendlyError("Envie um arquivo com ate 10 MB.");
    }
  }

  try {
    const { supabase, companyId, role, businessArea, userProfileId } =
      await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canModifyClientDocuments(role, businessArea)) {
      return friendlyError(
        "Apenas admin, gerente ou consultor juridico podem editar documentos.",
      );
    }

    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const document = await getClientDocumentWithAccess(documentId);
    let nextFilePath = document.file_path;
    let nextFileName = document.file_name;
    let nextMimeType = document.mime_type;
    let nextFileSize = document.file_size;
    let uploadedReplacementPath: string | null = null;

    if (replacementFile instanceof File && replacementFile.size > 0) {
      const { filePath } = buildClientDocumentPath(
        companyId,
        document.client_id,
        replacementFile.name,
      );
      const buffer = Buffer.from(await replacementFile.arrayBuffer());
      const { error: uploadError } = await adminSupabase.storage
        .from(clientDocumentsBucket)
        .upload(filePath, buffer, {
          contentType: replacementFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        return friendlyError(uploadError.message);
      }

      uploadedReplacementPath = filePath;
      nextFilePath = filePath;
      nextFileName = replacementFile.name;
      nextMimeType = replacementFile.type || null;
      nextFileSize = replacementFile.size;
    }

    const { error } = await supabase
      .from("client_documents")
      .update({
        document_type: parsed.data.document_type,
        title: parsed.data.title,
        description: parsed.data.description,
        file_path: nextFilePath,
        file_name: nextFileName,
        mime_type: nextMimeType,
        file_size: nextFileSize,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      if (uploadedReplacementPath) {
        await adminSupabase.storage.from(clientDocumentsBucket).remove([uploadedReplacementPath]);
      }

      return friendlyError(error.message);
    }

    if (uploadedReplacementPath && uploadedReplacementPath !== document.file_path) {
      await adminSupabase.storage.from(clientDocumentsBucket).remove([document.file_path]);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: replacementFile instanceof File && replacementFile.size > 0
        ? "client_document.replaced"
        : "client_document.updated",
      entityType: "client_document",
      entityId: documentId,
      entityLabel: parsed.data.title || nextFileName,
      details: {
        client_id: document.client_id,
        pre_sale_id: document.pre_sale_id,
        document_type: parsed.data.document_type,
        replaced_file: Boolean(uploadedReplacementPath),
      },
    });

    revalidatePath(`/clientes/${document.client_id}`);

    if (document.pre_sale_id) {
      revalidatePath(`/pre-vendas/${document.pre_sale_id}`);
    }

    return {
      ok: true,
      message: uploadedReplacementPath
        ? "Documento substituido com sucesso."
        : "Documento atualizado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar o documento.",
    );
  }
}

export async function softDeleteClientDocumentAction(
  documentId: string,
): Promise<ClientDocumentActionState> {
  try {
    const { supabase, companyId, role, businessArea, userProfileId } =
      await getCurrentUserContext();

    if (!canModifyClientDocuments(role, businessArea)) {
      return friendlyError(
        "Apenas admin, gerente ou consultor juridico podem excluir documentos.",
      );
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
