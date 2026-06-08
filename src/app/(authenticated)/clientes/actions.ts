"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatCpf } from "@/lib/clients/masks";
import { clientFormSchema, type ClientPayload } from "@/lib/clients/schema";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client } from "@/types/client";

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

const clientFieldLabels: Record<keyof ClientPayload, string> = {
  full_name: "Nome completo",
  cpf: "CPF",
  rg: "RG",
  nationality: "Nacionalidade",
  birth_date: "Data de nascimento",
  marital_status: "Estado civil",
  profession: "Profissao",
  email: "Email",
  phone_mobile: "Celular",
  phone_secondary: "Telefone secundario",
  zip_code: "CEP",
  street: "Rua",
  number: "Numero",
  district: "Bairro",
  city: "Cidade",
  state: "Estado",
  notes: "Observacoes",
  legal_responsible_user_id: "Adm responsavel",
  legal_consultant_user_id: "Consultor responsavel",
};

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  return value ?? null;
}

function getChangedClientFields(currentClient: Client, nextValues: ClientPayload) {
  return (Object.entries(clientFieldLabels) as Array<[keyof ClientPayload, string]>)
    .filter(([field]) => {
      return (
        normalizeComparableValue(currentClient[field as keyof Client]) !==
        normalizeComparableValue(nextValues[field])
      );
    })
    .map(([, label]) => label);
}

function requireChangeNote(changeNote?: string | null) {
  const normalizedChangeNote = changeNote?.trim();
  return normalizedChangeNote ? normalizedChangeNote : null;
}

function isMissingLegalResponsibleColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    message.includes("clients") &&
    (message.includes("legal_responsible_user_id") ||
      message.includes("legal_consultant_user_id"))
  );
}

function withoutLegalResponsibleField<
  T extends {
    legal_responsible_user_id?: string | null;
    legal_consultant_user_id?: string | null;
  },
>(values: T) {
  const clonedValues: Partial<T> = { ...values };
  delete clonedValues.legal_responsible_user_id;
  delete clonedValues.legal_consultant_user_id;
  return clonedValues;
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
  changeNote?: string | null,
): Promise<ClientActionState> {
  void changeNote;
  const parsed = clientFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do cliente.");
  }

  let createdClientId = "";

  try {
    const { supabase, userProfileId, companyId, role, businessArea, profile } =
      await getCurrentUserContext();
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

    const clientValues = {
      ...parsed.data,
      company_id: companyId,
      created_by: userProfileId,
    };
    let { data, error } = await supabase
      .from("clients")
      .insert(clientValues)
      .select("id")
      .single();

    if (error && isMissingLegalResponsibleColumn(error)) {
      const legacyCompatibleValues = withoutLegalResponsibleField(clientValues);
      const retry = await supabase
        .from("clients")
        .insert(legacyCompatibleValues)
        .select("id")
        .single();
      data = retry.data;
      error = retry.error;
    }

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

    await recordClientTimelineEvent({
      companyId,
      clientId: createdClientId,
      eventType: "client_created",
      title: "Cliente cadastrado",
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
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
  changeNote?: string | null,
): Promise<ClientActionState> {
  const parsed = clientFormSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira os campos obrigatorios do cliente.");
  }

  const normalizedChangeNote = requireChangeNote(changeNote);

  if (!normalizedChangeNote) {
    return friendlyError("Descreva o que foi alterado no cliente e por que.");
  }

  let updated = false;

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const duplicatedCpf = await findClientByCpf(
      parsed.data.cpf,
      companyId,
      clientId,
    );

    if (duplicatedCpf) {
      return friendlyError("Ja existe cliente cadastrado com esse CPF.");
    }

    const { data: currentClientData, error: currentClientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();
    const currentClient = currentClientData as Client | null;

    if (currentClientError || !currentClient) {
      return friendlyError("Cliente nao encontrado para atualizacao.");
    }

    const changedFields = getChangedClientFields(currentClient, parsed.data);

    const clientValues = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase
      .from("clients")
      .update(clientValues)
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error && isMissingLegalResponsibleColumn(error)) {
      const legacyCompatibleValues = withoutLegalResponsibleField(clientValues);
      const retry = await supabase
        .from("clients")
        .update(legacyCompatibleValues)
        .eq("id", clientId)
        .eq("company_id", companyId)
        .is("deleted_at", null);
      error = retry.error;
    }

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

    await recordClientTimelineEvent({
      companyId,
      clientId,
      eventType: "client_updated",
      title:
        changedFields.length > 0
          ? "Cadastro do cliente atualizado"
          : "Cadastro do cliente revisado",
      note: normalizedChangeNote,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        changed_fields: changedFields,
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

export async function addClientTimelineNoteAction(
  clientId: string,
  note: string,
): Promise<ClientActionState> {
  const normalizedNote = note.trim();

  if (!normalizedNote) {
    return friendlyError("Escreva uma anotacao antes de enviar.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("id", clientId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (clientError || !clientData) {
      return friendlyError("Cliente nao encontrado para adicionar anotacao.");
    }

    await recordClientTimelineEvent({
      companyId,
      clientId,
      eventType: "manual_note",
      title: "Anotacao adicionada",
      note: normalizedNote,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.timeline_note_added",
      entityType: "client",
      entityId: clientId,
      entityLabel: clientData.full_name,
      details: {
        note: normalizedNote,
      },
    });
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel salvar a anotacao.",
    );
  }

  revalidatePath(`/clientes/${clientId}`);
  return {
    ok: true,
    message: "Anotacao salva com sucesso.",
  };
}

export async function updateClientTimelineNoteAction(
  eventId: string,
  note: string,
): Promise<ClientActionState> {
  const normalizedNote = note.trim();

  if (!normalizedNote) {
    return friendlyError("Escreva uma anotacao antes de salvar.");
  }

  try {
    const { supabase, companyId, userProfileId, role, businessArea } =
      await getCurrentUserContext();
    const canManageAllTimelineNotes = role === "admin" || role === "manager";

    if (!canManageAllTimelineNotes && businessArea !== "legal") {
      return friendlyError("Apenas integrantes do juridico podem editar anotacoes.");
    }

    const adminClient = createAdminClient();
    const { data: eventData, error: eventError } = await adminClient
      .from("client_timeline_events")
      .select("id, client_id, title, note, actor_user_profile_id, details")
      .eq("id", eventId)
      .eq("company_id", companyId)
      .maybeSingle();
    const timelineEvent = eventData as {
      id: string;
      client_id: string;
      title: string;
      note: string | null;
      actor_user_profile_id: string | null;
      details: Record<string, unknown> | null;
    } | null;

    if (eventError || !timelineEvent) {
      return friendlyError("Anotacao nao encontrada.");
    }

    if (!canManageAllTimelineNotes && timelineEvent.actor_user_profile_id !== userProfileId) {
      return friendlyError("Voce so pode editar anotacoes feitas por voce.");
    }

    if (!timelineEvent.note?.trim()) {
      return friendlyError("Este registro nao possui anotacao editavel.");
    }

    const editedAt = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("client_timeline_events")
      .update({
        note: normalizedNote,
        details: {
          ...(timelineEvent.details ?? {}),
          note_edited_at: editedAt,
          note_edited_by: userProfileId,
        },
      })
      .eq("id", timelineEvent.id)
      .eq("company_id", companyId);

    if (updateError) {
      return friendlyError(updateError.message);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.timeline_note_updated",
      entityType: "client",
      entityId: timelineEvent.client_id,
      entityLabel: timelineEvent.title,
      details: {
        timeline_event_id: timelineEvent.id,
        previous_note: timelineEvent.note,
        next_note: normalizedNote,
        edited_at: editedAt,
      },
    });

    revalidatePath(`/clientes/${timelineEvent.client_id}`);

    return {
      ok: true,
      message: "Anotacao atualizada com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar a anotacao.",
    );
  }
}

export async function deleteClientTimelineNoteAction(
  eventId: string,
): Promise<ClientActionState> {
  try {
    const { supabase, companyId, userProfileId, role, businessArea } =
      await getCurrentUserContext();
    const canManageAllTimelineNotes = role === "admin" || role === "manager";

    if (!canManageAllTimelineNotes && businessArea !== "legal") {
      return friendlyError("Apenas integrantes do juridico podem remover anotacoes.");
    }

    const adminClient = createAdminClient();
    const { data: eventData, error: eventError } = await adminClient
      .from("client_timeline_events")
      .select("id, client_id, title, note, actor_user_profile_id, details")
      .eq("id", eventId)
      .eq("company_id", companyId)
      .maybeSingle();
    const timelineEvent = eventData as {
      id: string;
      client_id: string;
      title: string;
      note: string | null;
      actor_user_profile_id: string | null;
      details: Record<string, unknown> | null;
    } | null;

    if (eventError || !timelineEvent) {
      return friendlyError("Anotacao nao encontrada.");
    }

    if (!canManageAllTimelineNotes && timelineEvent.actor_user_profile_id !== userProfileId) {
      return friendlyError("Voce so pode remover anotacoes feitas por voce.");
    }

    if (!timelineEvent.note?.trim()) {
      return friendlyError("Este registro nao possui anotacao removivel.");
    }

    const { error: deleteError } = await adminClient
      .from("client_timeline_events")
      .delete()
      .eq("id", timelineEvent.id)
      .eq("company_id", companyId);

    if (deleteError) {
      return friendlyError(deleteError.message);
    }

    const rdActivityId =
      typeof timelineEvent.details?.rd_activity_id === "string"
        ? timelineEvent.details.rd_activity_id
        : null;

    if (rdActivityId) {
      await adminClient
        .from("rd_crm_activity_import")
        .update({
          import_status: "deleted",
          timeline_event_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId)
        .eq("rd_activity_id", rdActivityId);
    }

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "client.timeline_note_deleted",
      entityType: "client",
      entityId: timelineEvent.client_id,
      entityLabel: timelineEvent.title,
      details: {
        timeline_event_id: timelineEvent.id,
        previous_note: timelineEvent.note,
        rd_activity_id: rdActivityId,
      },
    });

    revalidatePath(`/clientes/${timelineEvent.client_id}`);

    return {
      ok: true,
      message: "Anotacao removida com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel remover a anotacao.",
    );
  }
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
