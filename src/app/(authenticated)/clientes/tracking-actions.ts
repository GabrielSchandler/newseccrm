"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { recordClientTimelineEvent } from "@/lib/client-timeline/service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientTrackingStatus, ClientTrackingUpdate } from "@/types/client-tracking";

export type ClientTrackingActionState = {
  ok: boolean;
  message: string;
};

const trackingPayloadSchema = z.object({
  client_id: z.string().uuid(),
  pre_sale_id: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(3000),
  status: z.enum(["in_progress", "completed", "cancelled"]),
  visible_to_client: z.boolean().default(true),
  event_at: z.string().min(1),
});

function friendlyError(message = "Nao foi possivel salvar o acompanhamento.") {
  return {
    ok: false,
    message,
  };
}

function normalizeEventAt(value: string) {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00-03:00`
    : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function assertTrackingAccess(clientId: string, preSaleId: string) {
  const { companyId, role, businessArea } = await getCurrentUserContext();
  const adminSupabase = createAdminClient();

  const { data: client, error: clientError } = await adminSupabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (clientError) {
    throw clientError;
  }

  if (!client) {
    return { allowed: false, message: "Cliente nao encontrado nesta empresa." };
  }

  const { data: preSale, error: preSaleError } = await adminSupabase
    .from("pre_sales")
    .select("id")
    .eq("id", preSaleId)
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (preSaleError) {
    throw preSaleError;
  }

  if (!preSale) {
    return { allowed: false, message: "Selecione uma pre-venda deste cliente." };
  }

  const canManageTracking =
    role === "admin" ||
    role === "manager" ||
    (role === "seller" && (businessArea === "legal" || businessArea === "commercial"));

  if (!canManageTracking) {
    return { allowed: false, message: "Seu usuario nao pode alterar o acompanhamento." };
  }

  return { allowed: true, message: null };
}

async function loadTrackingUpdate(updateId: string, companyId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("client_tracking_updates")
    .select("*")
    .eq("id", updateId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ClientTrackingUpdate | null;
}

export async function createClientTrackingUpdateAction(
  values: z.input<typeof trackingPayloadSchema>,
): Promise<ClientTrackingActionState> {
  const parsed = trackingPayloadSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira titulo, descricao, status e data do acompanhamento.");
  }

  const eventAt = normalizeEventAt(parsed.data.event_at);

  if (!eventAt) {
    return friendlyError("Informe uma data valida para a movimentacao.");
  }

  try {
    const { companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const access = await assertTrackingAccess(parsed.data.client_id, parsed.data.pre_sale_id);

    if (!access.allowed) {
      return friendlyError(access.message ?? undefined);
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("client_tracking_updates")
      .insert({
        company_id: companyId,
        client_id: parsed.data.client_id,
        pre_sale_id: parsed.data.pre_sale_id,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        visible_to_client: parsed.data.visible_to_client,
        event_at: eventAt,
        created_by: userProfileId,
      })
      .select("id")
      .single();

    if (error) {
      return friendlyError(error.message);
    }

    await recordClientTimelineEvent({
      companyId,
      clientId: parsed.data.client_id,
      preSaleId: parsed.data.pre_sale_id,
      eventType: "tracking_update_created",
      title: "Acompanhamento do cliente atualizado",
      note: `Nova movimentacao adicionada: ${parsed.data.title}`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        tracking_update_id: (data as { id: string }).id,
        tracking_status: parsed.data.status,
        visible_to_client: parsed.data.visible_to_client,
        event_at: eventAt,
      },
    });

    revalidatePath(`/clientes/${parsed.data.client_id}`);
    revalidatePath("/acompanhamento");

    return {
      ok: true,
      message: "Acompanhamento registrado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel registrar o acompanhamento.",
    );
  }
}

export async function updateClientTrackingUpdateAction(
  updateId: string,
  values: z.input<typeof trackingPayloadSchema>,
): Promise<ClientTrackingActionState> {
  const parsed = trackingPayloadSchema.safeParse(values);

  if (!parsed.success) {
    return friendlyError("Confira titulo, descricao, status e data do acompanhamento.");
  }

  const eventAt = normalizeEventAt(parsed.data.event_at);

  if (!eventAt) {
    return friendlyError("Informe uma data valida para a movimentacao.");
  }

  try {
    const { companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const existing = await loadTrackingUpdate(updateId, companyId);

    if (!existing) {
      return friendlyError("Acompanhamento nao encontrado.");
    }

    const access = await assertTrackingAccess(existing.client_id, existing.pre_sale_id);

    if (!access.allowed) {
      return friendlyError(access.message ?? undefined);
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("client_tracking_updates")
      .update({
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status as ClientTrackingStatus,
        visible_to_client: parsed.data.visible_to_client,
        event_at: eventAt,
        updated_by: userProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordClientTimelineEvent({
      companyId,
      clientId: existing.client_id,
      preSaleId: existing.pre_sale_id,
      eventType: "tracking_update_updated",
      title: "Acompanhamento do cliente editado",
      note: `Movimentacao editada: ${parsed.data.title}`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        tracking_update_id: updateId,
        previous_status: existing.status,
        next_status: parsed.data.status,
        visible_to_client: parsed.data.visible_to_client,
        event_at: eventAt,
      },
    });

    revalidatePath(`/clientes/${existing.client_id}`);
    revalidatePath("/acompanhamento");

    return {
      ok: true,
      message: "Acompanhamento atualizado com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel atualizar o acompanhamento.",
    );
  }
}

export async function deleteClientTrackingUpdateAction(
  updateId: string,
): Promise<ClientTrackingActionState> {
  try {
    const { companyId, userProfileId, role, businessArea, profile } =
      await getCurrentUserContext();
    const existing = await loadTrackingUpdate(updateId, companyId);

    if (!existing) {
      return friendlyError("Acompanhamento nao encontrado.");
    }

    const access = await assertTrackingAccess(existing.client_id, existing.pre_sale_id);

    if (!access.allowed) {
      return friendlyError(access.message ?? undefined);
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("client_tracking_updates")
      .update({
        deleted_by: userProfileId,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", updateId)
      .eq("company_id", companyId);

    if (error) {
      return friendlyError(error.message);
    }

    await recordClientTimelineEvent({
      companyId,
      clientId: existing.client_id,
      preSaleId: existing.pre_sale_id,
      eventType: "tracking_update_deleted",
      title: "Acompanhamento do cliente removido",
      note: `Movimentacao removida: ${existing.title}`,
      actorUserProfileId: userProfileId,
      actorRole: role,
      actorBusinessArea: businessArea,
      actor: profile,
      details: {
        tracking_update_id: updateId,
        tracking_status: existing.status,
        visible_to_client: existing.visible_to_client,
      },
    });

    revalidatePath(`/clientes/${existing.client_id}`);
    revalidatePath("/acompanhamento");

    return {
      ok: true,
      message: "Acompanhamento removido com sucesso.",
    };
  } catch (error) {
    return friendlyError(
      error instanceof Error ? error.message : "Nao foi possivel remover o acompanhamento.",
    );
  }
}
