"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { normalizeDocumentClientAccessRequest } from "@/lib/client-approvals/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acceptedClientDocumentMimeTypes,
  assertClientBelongsToCompany,
  assertPreSaleBelongsToClient,
  buildClientDocumentPath,
  canModifyClientDocuments,
  canManageClientDocuments,
  clientDocumentsBucket,
  getClientDocumentWithAccess,
  isAllowedClientDocumentFile,
  maxClientDocumentSize,
  resolveClientDocumentContentType,
} from "@/lib/client-documents/service";
import {
  clientDocumentUploadSchema,
  clientDocumentUpdateSchema,
  type ClientDocumentUpdatePayload,
  type ClientDocumentUploadPayload,
} from "@/lib/client-documents/schema";
import { clientDocumentAcceptedFormatsLabel } from "@/types/client-document";

export type ClientDocumentActionState = {
  ok: boolean;
  message: string;
  url?: string;
};

type ClientDocumentFileMeta = {
  name: string;
  size: number;
  type: string;
};

export type PreparedClientDocumentUpload = {
  index: number;
  documentId: string;
  filePath: string;
  token: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  title: string;
};

export type ClientDocumentPrepareUploadState = ClientDocumentActionState & {
  uploads?: PreparedClientDocumentUpload[];
};

function friendlyError(message: string): ClientDocumentActionState {
  return {
    ok: false,
    message,
  };
}

function prepareFriendlyError(message: string): ClientDocumentPrepareUploadState {
  return friendlyError(message);
}

function getTitleFromFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  return (lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName).trim() || fileName;
}

function buildClientAccessRequestFields(
  documentType: ClientDocumentUploadPayload["document_type"],
  visibleToClient: boolean,
  downloadableByClient: boolean,
  userProfileId: string,
) {
  const request = normalizeDocumentClientAccessRequest({
    documentType,
    visibleToClient,
    downloadableByClient,
  });
  const requestedAt = request.status === "pending" ? new Date().toISOString() : null;

  return {
    ...request,
    fields: {
      client_visibility_requested: request.visibleToClient,
      client_download_requested: request.downloadableByClient,
      client_access_status: request.status,
      client_access_requested_by: request.status === "pending" ? userProfileId : null,
      client_access_requested_at: requestedAt,
      client_access_reviewed_by: null,
      client_access_reviewed_at: null,
      client_access_review_note: null,
    },
  };
}

function mergeClientDocumentMimeTypes(
  currentAllowedMimeTypes: string[] | null | undefined,
) {
  if (!Array.isArray(currentAllowedMimeTypes)) {
    return null;
  }

  return Array.from(
    new Set([...currentAllowedMimeTypes, ...acceptedClientDocumentMimeTypes]),
  );
}

async function ensureClientDocumentsBucketAvailable() {
  const adminSupabase = createAdminClient();
  const { data: bucket, error } = await adminSupabase.storage.getBucket(clientDocumentsBucket);

  if (!error) {
    const currentLimit = bucket.file_size_limit;
    const currentAllowedMimeTypes = bucket.allowed_mime_types ?? null;
    const missingAllowedMimeTypes =
      Array.isArray(currentAllowedMimeTypes) &&
      acceptedClientDocumentMimeTypes.some(
        (mimeType) => !currentAllowedMimeTypes.includes(mimeType),
      );
    const needsSizeUpdate =
      typeof currentLimit === "number" &&
      currentLimit > 0 &&
      currentLimit < maxClientDocumentSize;

    if (needsSizeUpdate || missingAllowedMimeTypes) {
      const { error: updateError } = await adminSupabase.storage.updateBucket(
        clientDocumentsBucket,
        {
          public: bucket.public,
          fileSizeLimit: maxClientDocumentSize,
          allowedMimeTypes: mergeClientDocumentMimeTypes(currentAllowedMimeTypes),
        },
      );

      if (updateError) {
        return friendlyError(
          `Não foi possível ajustar o bucket '${clientDocumentsBucket}'. Confira no Supabase Storage o limite de 20 MB e os tipos MIME permitidos para documentos.`,
        );
      }
    }

    return null;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return friendlyError(
      "O bucket privado 'client-documents' ainda não existe nesta instância do Supabase.",
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
      `Formato inválido. Envie ${clientDocumentAcceptedFormatsLabel}.`,
    );
  }

  if (file.size <= 0) {
    return friendlyError("O arquivo esta vazio.");
  }

  if (file.size > maxClientDocumentSize) {
    return friendlyError("Envie um arquivo com até 20 MB.");
  }

  const { client_id: clientId, pre_sale_id: preSaleId } = parsed.data;

  if (parsed.data.client_visibility_requested && !preSaleId) {
    return friendlyError(
      "Selecione a pré-venda para vincular a publicação ao protocolo correto.",
    );
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canManageClientDocuments(role)) {
      return friendlyError("Você não tem permissão para enviar documentos.");
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
    const contentType = resolveClientDocumentContentType(file);
    const clientAccess = buildClientAccessRequestFields(
      parsed.data.document_type,
      parsed.data.client_visibility_requested,
      parsed.data.client_download_requested,
      userProfileId,
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminSupabase.storage
      .from(clientDocumentsBucket)
      .upload(filePath, buffer, {
        contentType,
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
      mime_type: contentType,
      file_size: file.size,
      uploaded_by: userProfileId,
      ...clientAccess.fields,
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
        client_access_status: clientAccess.status,
        client_download_requested: clientAccess.downloadableByClient,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId,
      preSaleId,
      eventType: "client_document_uploaded",
      title: "Documento enviado ao cadastro do cliente",
      note: `Arquivo "${parsed.data.title || file.name}" adicionado ao histórico documental do cliente.`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        document_type: parsed.data.document_type,
        file_name: file.name,
      },
    });

    revalidatePath(`/clientes/${clientId}`);
    revalidatePath("/aprovacoes");

    if (preSaleId) {
      revalidatePath(`/pre-vendas/${preSaleId}`);
    }

    return {
      ok: true,
      message: "Documento enviado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível enviar o documento.",
    );
  }
}

export async function uploadClientDocumentsBulkAction(
  values: ClientDocumentUploadPayload,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const parsed = clientDocumentUploadSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados dos documentos.");
  }

  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!files.length) {
    return friendlyError("Selecione pelo menos um arquivo.");
  }

  for (const file of files) {
    if (!isAllowedClientDocumentFile(file)) {
      return friendlyError(
        `Formato inválido em "${file.name}". Envie ${clientDocumentAcceptedFormatsLabel}.`,
      );
    }

    if (file.size > maxClientDocumentSize) {
      return friendlyError(`O arquivo "${file.name}" ultrapassa o limite de 20 MB.`);
    }
  }

  const { client_id: clientId, pre_sale_id: preSaleId } = parsed.data;
  const uploadedPaths: string[] = [];

  if (parsed.data.client_visibility_requested && !preSaleId) {
    return friendlyError(
      "Selecione a pré-venda para vincular a publicação ao protocolo correto.",
    );
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canManageClientDocuments(role)) {
      return friendlyError("Você não tem permissão para enviar documentos.");
    }

    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    await assertClientBelongsToCompany(clientId, companyId);

    if (preSaleId) {
      await assertPreSaleBelongsToClient(preSaleId, clientId, companyId);
    }

    const documentsToInsert = [];

    for (const file of files) {
      const { documentId, filePath } = buildClientDocumentPath(companyId, clientId, file.name);
      const contentType = resolveClientDocumentContentType(file);
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await adminSupabase.storage
        .from(clientDocumentsBucket)
        .upload(filePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        if (uploadedPaths.length) {
          await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
        }

        return friendlyError(uploadError.message);
      }

      uploadedPaths.push(filePath);
      const documentTitle =
        files.length === 1 && parsed.data.title
          ? parsed.data.title
          : getTitleFromFileName(file.name);
      const clientAccess = buildClientAccessRequestFields(
        parsed.data.document_type,
        parsed.data.client_visibility_requested,
        parsed.data.client_download_requested,
        userProfileId,
      );

      documentsToInsert.push({
        id: documentId,
        company_id: companyId,
        client_id: clientId,
        pre_sale_id: preSaleId,
        document_type: parsed.data.document_type,
        title: documentTitle,
        description: parsed.data.description,
        file_name: file.name,
        file_path: filePath,
        mime_type: contentType,
        file_size: file.size,
        uploaded_by: userProfileId,
        ...clientAccess.fields,
      });
    }

    const { error: insertError } = await supabase
      .from("client_documents")
      .insert(documentsToInsert);

    if (insertError) {
      await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
      return friendlyError(insertError.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: files.length > 1 ? "client_document.bulk_uploaded" : "client_document.uploaded",
      entityType: "client_document",
      entityId: clientId,
      entityLabel: `${files.length} documento(s) enviados`,
      details: {
        client_id: clientId,
        pre_sale_id: preSaleId,
        document_type: parsed.data.document_type,
        file_names: files.map((file) => file.name),
        client_visibility_requested: parsed.data.client_visibility_requested,
        client_download_requested: parsed.data.client_download_requested,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId,
      preSaleId,
      eventType: "client_document_uploaded",
      title:
        files.length > 1
          ? "Documentos enviados em massa"
          : "Documento enviado ao cadastro do cliente",
      note:
        files.length > 1
          ? `${files.length} arquivos adicionados ao histórico documental do cliente: ${files
              .map((file) => file.name)
              .join(", ")}.`
          : `Arquivo "${documentsToInsert[0]?.title || files[0]?.name}" adicionado ao histórico documental do cliente.`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        document_type: parsed.data.document_type,
        file_names: files.map((file) => file.name),
      },
    });

    revalidatePath(`/clientes/${clientId}`);
    revalidatePath("/aprovacoes");

    if (preSaleId) {
      revalidatePath(`/pre-vendas/${preSaleId}`);
    }

    return {
      ok: true,
      message:
        files.length > 1
          ? `${files.length} documentos enviados com sucesso.`
          : "Documento enviado com sucesso.",
    };
  } catch (error) {
    if (uploadedPaths.length) {
      const adminSupabase = createAdminClient();
      await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
    }

    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível enviar os documentos.",
    );
  }
}

export async function prepareClientDocumentsBulkUploadAction(
  values: ClientDocumentUploadPayload,
  files: ClientDocumentFileMeta[],
): Promise<ClientDocumentPrepareUploadState> {
  const parsed = clientDocumentUploadSchema.safeParse(values);

  if (!parsed.success) {
    return prepareFriendlyError("Confira os dados dos documentos.");
  }

  if (!files.length) {
    return prepareFriendlyError("Selecione pelo menos um arquivo.");
  }

  if (files.length > 30) {
    return prepareFriendlyError("Envie no maximo 30 arquivos por vez.");
  }

  for (const file of files) {
    if (!file.name || file.size <= 0) {
      return prepareFriendlyError(`O arquivo "${file.name || "sem nome"}" esta vazio.`);
    }

    if (!isAllowedClientDocumentFile(file)) {
      return prepareFriendlyError(
        `Formato inválido em "${file.name}". Envie ${clientDocumentAcceptedFormatsLabel}.`,
      );
    }

    if (file.size > maxClientDocumentSize) {
      return prepareFriendlyError(`O arquivo "${file.name}" ultrapassa o limite de 20 MB.`);
    }
  }

  const { client_id: clientId, pre_sale_id: preSaleId } = parsed.data;

  if (parsed.data.client_visibility_requested && !preSaleId) {
    return prepareFriendlyError(
      "Selecione a pré-venda para vincular a publicação ao protocolo correto.",
    );
  }

  try {
    const { companyId, role } = await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canManageClientDocuments(role)) {
      return prepareFriendlyError("Você não tem permissão para enviar documentos.");
    }

    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    await assertClientBelongsToCompany(clientId, companyId);

    if (preSaleId) {
      await assertPreSaleBelongsToClient(preSaleId, clientId, companyId);
    }

    const uploads: PreparedClientDocumentUpload[] = [];

    for (const [index, file] of files.entries()) {
      const { documentId, filePath } = buildClientDocumentPath(companyId, clientId, file.name);
      const { data, error } = await adminSupabase.storage
        .from(clientDocumentsBucket)
        .createSignedUploadUrl(filePath);

      if (error || !data?.token) {
        return prepareFriendlyError(
          error?.message || `Não foi possível preparar o envio de "${file.name}".`,
        );
      }

      uploads.push({
        index,
        documentId,
        filePath,
        token: data.token,
        fileName: file.name,
        mimeType: resolveClientDocumentContentType(file),
        fileSize: file.size,
        title:
          files.length === 1 && parsed.data.title
            ? parsed.data.title
            : getTitleFromFileName(file.name),
      });
    }

    return {
      ok: true,
      message: "Envio preparado.",
      uploads,
    };
  } catch (error) {
    return prepareFriendlyError(
      error instanceof Error ? error.message : "Não foi possível preparar o envio dos documentos.",
    );
  }
}

function isPreparedUploadForClient(
  upload: PreparedClientDocumentUpload,
  companyId: string,
  clientId: string,
) {
  return (
    upload.documentId &&
    upload.filePath.startsWith(`${companyId}/${clientId}/`) &&
    upload.filePath.includes(upload.documentId) &&
    upload.fileName &&
    upload.fileSize > 0
  );
}

export async function completeClientDocumentsBulkUploadAction(
  values: ClientDocumentUploadPayload,
  uploads: PreparedClientDocumentUpload[],
): Promise<ClientDocumentActionState> {
  const parsed = clientDocumentUploadSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados dos documentos.");
  }

  if (!uploads.length) {
    return friendlyError("Nenhum arquivo foi enviado.");
  }

  const { client_id: clientId, pre_sale_id: preSaleId } = parsed.data;
  const uploadedPaths = uploads.map((upload) => upload.filePath);

  if (parsed.data.client_visibility_requested && !preSaleId) {
    return friendlyError(
      "Selecione a pré-venda para vincular a publicação ao protocolo correto.",
    );
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canManageClientDocuments(role)) {
      return friendlyError("Você não tem permissão para enviar documentos.");
    }

    await assertClientBelongsToCompany(clientId, companyId);

    if (preSaleId) {
      await assertPreSaleBelongsToClient(preSaleId, clientId, companyId);
    }

    if (
      uploads.some(
        (upload) => !isPreparedUploadForClient(upload, companyId, clientId),
      )
    ) {
      await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
      return friendlyError("Os dados do envio estao inválidos. Selecione os arquivos novamente.");
    }

    const documentsToInsert = uploads.map((upload) => ({
      id: upload.documentId,
      company_id: companyId,
      client_id: clientId,
      pre_sale_id: preSaleId,
      document_type: parsed.data.document_type,
      title: upload.title,
      description: parsed.data.description,
      file_name: upload.fileName,
      file_path: upload.filePath,
      mime_type: upload.mimeType,
      file_size: upload.fileSize,
      uploaded_by: userProfileId,
      ...buildClientAccessRequestFields(
        parsed.data.document_type,
        parsed.data.client_visibility_requested,
        parsed.data.client_download_requested,
        userProfileId,
      ).fields,
    }));

    const { error: insertError } = await adminSupabase
      .from("client_documents")
      .insert(documentsToInsert);

    if (insertError) {
      await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
      return friendlyError(insertError.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action:
        uploads.length > 1 ? "client_document.bulk_uploaded" : "client_document.uploaded",
      entityType: "client_document",
      entityId: clientId,
      entityLabel: `${uploads.length} documento(s) enviados`,
      details: {
        client_id: clientId,
        pre_sale_id: preSaleId,
        document_type: parsed.data.document_type,
        file_names: uploads.map((upload) => upload.fileName),
        client_visibility_requested: parsed.data.client_visibility_requested,
        client_download_requested: parsed.data.client_download_requested,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId,
      preSaleId,
      eventType: "client_document_uploaded",
      title:
        uploads.length > 1
          ? "Documentos enviados em massa"
          : "Documento enviado ao cadastro do cliente",
      note:
        uploads.length > 1
          ? `${uploads.length} arquivos adicionados ao histórico documental do cliente: ${uploads
              .map((upload) => upload.fileName)
              .join(", ")}.`
          : `Arquivo "${uploads[0]?.title || uploads[0]?.fileName}" adicionado ao histórico documental do cliente.`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        document_type: parsed.data.document_type,
        file_names: uploads.map((upload) => upload.fileName),
      },
    });

    revalidatePath(`/clientes/${clientId}`);
    revalidatePath("/aprovacoes");

    if (preSaleId) {
      revalidatePath(`/pre-vendas/${preSaleId}`);
    }

    return {
      ok: true,
      message:
        uploads.length > 1
          ? `${uploads.length} documentos enviados com sucesso.`
          : "Documento enviado com sucesso.",
    };
  } catch (error) {
    if (uploadedPaths.length) {
      const adminSupabase = createAdminClient();
      await adminSupabase.storage.from(clientDocumentsBucket).remove(uploadedPaths);
    }

    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível concluir o envio dos documentos.",
    );
  }
}

export async function cancelClientDocumentsBulkUploadAction(
  filePaths: string[],
): Promise<ClientDocumentActionState> {
  try {
    const { companyId } = await getCurrentUserContext();
    const validPaths = filePaths.filter((filePath) =>
      filePath.startsWith(`${companyId}/`),
    );

    if (validPaths.length) {
      await createAdminClient().storage.from(clientDocumentsBucket).remove(validPaths);
    }

    return {
      ok: true,
      message: "Envio cancelado.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível cancelar o envio.",
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
      return friendlyError(error?.message || "Não foi possível gerar o link do documento.");
    }

    return {
      ok: true,
      message: mode === "download" ? "Download liberado." : "Visualização liberada.",
      url: data.signedUrl,
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível abrir o documento.",
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
    return friendlyError("Arquivo inválido para substituicao.");
  }

  if (replacementFile instanceof File && replacementFile.size > 0) {
    if (!isAllowedClientDocumentFile(replacementFile)) {
      return friendlyError(
        `Formato inválido. Envie ${clientDocumentAcceptedFormatsLabel}.`,
      );
    }

    if (replacementFile.size > maxClientDocumentSize) {
      return friendlyError("Envie um arquivo com até 20 MB.");
    }
  }

  try {
    const { supabase, companyId, role, businessArea, userProfileId, profile } =
      await getCurrentUserContext();
    const adminSupabase = createAdminClient();

    if (!canModifyClientDocuments(role, businessArea)) {
      return friendlyError(
        "Apenas admin, gerente ou consultor jurídico podem editar documentos.",
      );
    }

    const bucketError = await ensureClientDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const document = await getClientDocumentWithAccess(documentId);
    const nextPreSaleId = parsed.data.pre_sale_id;

    if (nextPreSaleId) {
      await assertPreSaleBelongsToClient(
        nextPreSaleId,
        document.client_id,
        companyId,
      );
    }

    if (parsed.data.client_visibility_requested && !nextPreSaleId) {
      return friendlyError(
        "Selecione a pré-venda para vincular a publicação ao protocolo correto.",
      );
    }

    const clientAccess = buildClientAccessRequestFields(
      parsed.data.document_type,
      parsed.data.client_visibility_requested,
      parsed.data.client_download_requested,
      userProfileId,
    );
    let nextFilePath = document.file_path;
    let nextFileName = document.file_name;
    let nextMimeType = document.mime_type;
    let nextFileSize = document.file_size;
    let uploadedReplacementPath: string | null = null;

    if (replacementFile instanceof File && replacementFile.size > 0) {
      const contentType = resolveClientDocumentContentType(replacementFile);
      const { filePath } = buildClientDocumentPath(
        companyId,
        document.client_id,
        replacementFile.name,
      );
      const buffer = Buffer.from(await replacementFile.arrayBuffer());
      const { error: uploadError } = await adminSupabase.storage
        .from(clientDocumentsBucket)
        .upload(filePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        return friendlyError(uploadError.message);
      }

      uploadedReplacementPath = filePath;
      nextFilePath = filePath;
      nextFileName = replacementFile.name;
      nextMimeType = contentType;
      nextFileSize = replacementFile.size;
    }

    const { error } = await adminSupabase
      .from("client_documents")
      .update({
        pre_sale_id: nextPreSaleId,
        document_type: parsed.data.document_type,
        title: parsed.data.title,
        description: parsed.data.description,
        file_path: nextFilePath,
        file_name: nextFileName,
        mime_type: nextMimeType,
        file_size: nextFileSize,
        ...clientAccess.fields,
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
        next_pre_sale_id: nextPreSaleId,
        document_type: parsed.data.document_type,
        replaced_file: Boolean(uploadedReplacementPath),
        client_access_status: clientAccess.status,
        client_download_requested: clientAccess.downloadableByClient,
      },
    });

    await recordClientTimelineEvent({
      companyId,
      clientId: document.client_id,
      preSaleId: nextPreSaleId,
      eventType:
        replacementFile instanceof File && replacementFile.size > 0
          ? "client_document_replaced"
          : "client_document_updated",
      title:
        replacementFile instanceof File && replacementFile.size > 0
          ? "Documento substituido"
          : "Documento atualizado",
      note:
        replacementFile instanceof File && replacementFile.size > 0
          ? `O documento "${parsed.data.title || nextFileName}" foi substituido por um novo arquivo.`
          : `Os dados do documento "${parsed.data.title || nextFileName}" foram ajustados no cadastro do cliente.`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        document_type: parsed.data.document_type,
        replaced_file: Boolean(uploadedReplacementPath),
      },
    });

    revalidatePath(`/clientes/${document.client_id}`);
    revalidatePath("/aprovacoes");
    revalidatePath("/acompanhamento");

    if (nextPreSaleId) {
      revalidatePath(`/pre-vendas/${nextPreSaleId}`);
    }

    if (document.pre_sale_id && document.pre_sale_id !== nextPreSaleId) {
      revalidatePath(`/pre-vendas/${document.pre_sale_id}`);
    }

    return {
      ok: true,
      message: uploadedReplacementPath
        ? clientAccess.status === "pending"
          ? "Documento substituído e enviado para nova aprovação."
          : "Documento substituído com sucesso."
        : clientAccess.status === "pending"
          ? "Documento atualizado e enviado para aprovação."
          : "Documento atualizado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível atualizar o documento.",
    );
  }
}

export async function softDeleteClientDocumentAction(
  documentId: string,
): Promise<ClientDocumentActionState> {
  try {
    const { supabase, companyId, role, businessArea, userProfileId, profile } =
      await getCurrentUserContext();

    if (!canModifyClientDocuments(role, businessArea)) {
      return friendlyError(
        "Apenas admin, gerente ou consultor jurídico podem excluir documentos.",
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

    await recordClientTimelineEvent({
      companyId,
      clientId: document.client_id,
      preSaleId: document.pre_sale_id,
      eventType: "client_document_deleted",
      title: "Documento excluído",
      note: `O documento "${document.title || document.file_name}" foi removido do cadastro do cliente.`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        document_type: document.document_type,
      },
    });

    revalidatePath(`/clientes/${document.client_id}`);
    revalidatePath("/aprovacoes");
    revalidatePath("/acompanhamento");

    if (document.pre_sale_id) {
      revalidatePath(`/pre-vendas/${document.pre_sale_id}`);
    }

    return {
      ok: true,
      message: "Documento excluído.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Não foi possível excluir o documento.",
    );
  }
}
