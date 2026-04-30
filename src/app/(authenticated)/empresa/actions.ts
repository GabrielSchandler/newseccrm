"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  companyProfileSchema,
  type CompanyProfilePayload,
} from "@/lib/company/schema";
import { recordAuditLog } from "@/lib/audit/log";

const documentsBucket = "documents";
const maxLogoSize = 5 * 1024 * 1024;
const acceptedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export type CompanyActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

function friendlyError(message: string): CompanyActionState {
  return {
    ok: false,
    message,
  };
}

function canManageCompany(role: string | null) {
  return role === "admin";
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.message?.toLowerCase().includes("column") || false;
}

function normalizeCompanyError(error: { code?: string; message?: string } | Error | null) {
  const message = error instanceof Error ? error.message : error?.message || "Nao foi possivel atualizar a empresa.";

  if (
    "message" in (error ?? {}) &&
    isMissingColumnError(error as { code?: string; message?: string })
  ) {
    return "A tabela companies desta instancia ainda nao possui as colunas de configuracao da empresa. Rode o SQL da tela Empresa/Logs no Supabase.";
  }

  return message;
}

async function ensureDocumentsBucketAvailable() {
  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase.storage.from(documentsBucket).list("", { limit: 1 });

  if (!error) {
    return null;
  }

  if (error.message.toLowerCase().includes("bucket not found")) {
    return friendlyError(
      "O bucket privado 'documents' ainda nao existe nesta instancia. Crie-o no Supabase antes de subir a logo da empresa.",
    );
  }

  return null;
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "arquivo";
}

export async function updateCompanyProfileAction(
  values: CompanyProfilePayload,
): Promise<CompanyActionState> {
  const parsed = companyProfileSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os dados da empresa.");
  }

  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canManageCompany(role)) {
      return friendlyError("Apenas administradores podem editar a empresa.");
    }

    const { error } = await supabase
      .from("companies")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    if (error) {
      return friendlyError(normalizeCompanyError(error));
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "company.updated",
      entityType: "company",
      entityId: companyId,
      entityLabel: parsed.data.trade_name ?? parsed.data.legal_name ?? "Empresa",
      details: {
        fields: Object.keys(parsed.data),
      },
    });
  } catch (error) {
    return friendlyError(normalizeCompanyError(error as Error));
  }

  revalidatePath("/empresa");
  return {
    ok: true,
    message: "Perfil da empresa atualizado com sucesso.",
    redirectTo: "/empresa?success=updated",
  };
}

export async function uploadCompanyLogoAction(
  formData: FormData,
): Promise<CompanyActionState> {
  try {
    const bucketError = await ensureDocumentsBucketAvailable();

    if (bucketError) {
      return bucketError;
    }

    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canManageCompany(role)) {
      return friendlyError("Apenas administradores podem alterar a logo da empresa.");
    }

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("logo_path, trade_name, legal_name")
      .eq("id", companyId)
      .single();

    if (companyError) {
      return friendlyError(normalizeCompanyError(companyError));
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return friendlyError("Selecione uma imagem para a logo.");
    }

    if (!acceptedLogoTypes.has(file.type)) {
      return friendlyError("Formato nao suportado. Envie PNG, JPG ou WEBP.");
    }

    if (file.size > maxLogoSize) {
      return friendlyError("A logo deve ter no maximo 5 MB.");
    }

    const filePath = [
      companyId,
      "company",
      "logo",
      `${Date.now()}-${sanitizeFileName(file.name)}`,
    ].join("/");
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(documentsBucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return friendlyError(uploadError.message);
    }

    if (companyData.logo_path) {
      await supabase.storage.from(documentsBucket).remove([companyData.logo_path]);
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        logo_path: filePath,
        logo_file_name: file.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    if (updateError) {
      return friendlyError(normalizeCompanyError(updateError));
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "company.logo_uploaded",
      entityType: "company",
      entityId: companyId,
      entityLabel:
        (companyData.trade_name as string | null) ||
        (companyData.legal_name as string | null) ||
        "Empresa",
      details: {
        file_name: file.name,
        file_size: file.size,
      },
    });
  } catch (error) {
    return friendlyError(normalizeCompanyError(error as Error));
  }

  revalidatePath("/empresa");
  return {
    ok: true,
    message: "Logo da empresa atualizada com sucesso.",
    redirectTo: "/empresa?success=logo",
  };
}

export async function removeCompanyLogoAction(): Promise<CompanyActionState> {
  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (!canManageCompany(role)) {
      return friendlyError("Apenas administradores podem remover a logo da empresa.");
    }

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("logo_path, trade_name, legal_name")
      .eq("id", companyId)
      .single();

    if (companyError) {
      return friendlyError(normalizeCompanyError(companyError));
    }

    if (companyData.logo_path) {
      await supabase.storage.from(documentsBucket).remove([companyData.logo_path]);
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        logo_path: null,
        logo_file_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);

    if (updateError) {
      return friendlyError(normalizeCompanyError(updateError));
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "company.logo_removed",
      entityType: "company",
      entityId: companyId,
      entityLabel:
        (companyData.trade_name as string | null) ||
        (companyData.legal_name as string | null) ||
        "Empresa",
    });
  } catch (error) {
    return friendlyError(normalizeCompanyError(error as Error));
  }

  revalidatePath("/empresa");
  return {
    ok: true,
    message: "Logo da empresa removida com sucesso.",
    redirectTo: "/empresa?success=logo_removed",
  };
}
