"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatCpf } from "@/lib/clients/masks";
import { clientFormSchema, type ClientPayload } from "@/lib/clients/schema";

export type ClientActionState = {
  ok: boolean;
  message: string;
  deletedClientId?: string;
};

function friendlyError(message = "Nao foi possivel salvar o cliente.") {
  return {
    ok: false,
    message,
  };
}

type ExistingCpfClient = {
  id: string;
  deleted_at: string | null;
};

async function findClientByCpf(
  cpf: string,
  companyId: string,
  ignoredClientId?: string,
) {
  const { supabase } = await getCurrentUserContext();
  const cpfValues = Array.from(new Set([cpf, formatCpf(cpf)]));
  let query = supabase
    .from("clients")
    .select("id, deleted_at")
    .eq("company_id", companyId)
    .in("cpf", cpfValues)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .limit(1);

  if (ignoredClientId) {
    query = query.neq("id", ignoredClientId);
  }

  const { data, error } = await query.returns<ExistingCpfClient[]>();

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

export async function createClientAction(
  values: ClientPayload,
): Promise<ClientActionState> {
  const parsed = clientFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do cliente.");
  }

  let createdClientId = "";

  try {
    const { supabase, userProfileId, companyId } = await getCurrentUserContext();
    const existingClient = await findClientByCpf(parsed.data.cpf, companyId);

    if (existingClient?.deleted_at) {
      return {
        ok: false,
        message: "Ja existe um cliente excluido com este CPF",
        deletedClientId: existingClient.id,
      };
    }

    if (existingClient) {
      return friendlyError("Ja existe cliente cadastrado com esse CPF.");
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({
        ...parsed.data,
        company_id: companyId,
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return friendlyError("Ja existe cliente cadastrado com esse CPF.");
      }

      return friendlyError(error.message);
    }

    if (!data?.id) {
      return friendlyError("Cliente salvo, mas nao foi possivel abrir o cadastro.");
    }

    createdClientId = data.id;

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.created",
      entityType: "client",
      entityId: createdClientId,
      entityLabel: parsed.data.full_name,
      details: {
        cpf: parsed.data.cpf,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel criar o cliente.",
    );
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${createdClientId}?success=created`);
}

export async function updateClientAction(
  clientId: string,
  values: ClientPayload,
): Promise<ClientActionState> {
  const parsed = clientFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do cliente.");
  }

  let updated = false;

  try {
    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const duplicatedCpf = await findClientByCpf(
      parsed.data.cpf,
      companyId,
      clientId,
    );

    if (duplicatedCpf) {
      return friendlyError("Ja existe cliente cadastrado com esse CPF.");
    }

    const { error } = await supabase
      .from("clients")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      if (error.code === "23505") {
        return friendlyError("Ja existe cliente cadastrado com esse CPF.");
      }

      return friendlyError(error.message);
    }

    updated = true;

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.updated",
      entityType: "client",
      entityId: clientId,
      entityLabel: parsed.data.full_name,
      details: {
        cpf: parsed.data.cpf,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar o cliente.",
    );
  }

  if (updated) {
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${clientId}`);
  }

  redirect(`/clientes/${clientId}?success=updated`);
}

export async function softDeleteClientAction(
  clientId: string,
): Promise<ClientActionState> {
  try {
    const { supabase, userProfileId, companyId } = await getCurrentUserContext();

    const { error } = await supabase
      .from("clients")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.deleted",
      entityType: "client",
      entityId: clientId,
      entityLabel: clientId,
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel excluir o cliente.",
    );
  }

  revalidatePath("/clientes");
  redirect("/clientes?success=deleted");
}

export async function reactivateClientAction(
  clientId: string,
): Promise<ClientActionState> {
  try {
    const { supabase, companyId, role, userProfileId } = await getCurrentUserContext();

    if (role !== "admin") {
      return friendlyError("Apenas usuarios administradores podem reativar clientes.");
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("cpf")
      .eq("id", clientId)
      .eq("company_id", companyId)
      .not("deleted_at", "is", null)
      .single();
    const client = clientData as { cpf: string } | null;

    if (clientError || !client) {
      return friendlyError("Cliente excluido nao encontrado.");
    }

    const activeClientWithCpf = await findClientByCpf(
      client.cpf,
      companyId,
      clientId,
    );

    if (activeClientWithCpf && !activeClientWithCpf.deleted_at) {
      return friendlyError(
        "Nao foi possivel reativar: ja existe cliente ativo com esse CPF.",
      );
    }

    const { error } = await supabase
      .from("clients")
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("company_id", companyId)
      .not("deleted_at", "is", null);

    if (error) {
      return friendlyError(error.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.reactivated",
      entityType: "client",
      entityId: clientId,
      entityLabel: clientId,
      details: {
        cpf: client.cpf,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel reativar o cliente.",
    );
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?success=reactivated`);
}
