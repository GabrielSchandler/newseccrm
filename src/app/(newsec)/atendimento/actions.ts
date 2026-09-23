"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/current-user";

export type AtendimentoActionState = { ok: boolean; message: string };

/**
 * Envia mensagem de saída: grava a mensagem (status "pendente") e enfileira
 * o job de envio (outbound_jobs) — o worker persistente é quem de fato
 * chama o provedor depois. idempotencyKey é gerada no cliente (uma vez por
 * tentativa de envio) — reenviar com a MESMA chave (duplo clique, retry de
 * rede) não duplica: a constraint unique em messages(conversation_id,
 * idempotency_key) barra a segunda inserção, e aqui isso é tratado como
 * sucesso silencioso (idempotente), não erro.
 */
export async function enviarMensagemAction(
  conversationId: string,
  texto: string,
  idempotencyKey: string,
): Promise<AtendimentoActionState> {
  const textoLimpo = texto.trim();
  if (!textoLimpo) return { ok: false, message: "Mensagem vazia." };

  const { supabase, userProfileId, companyId } = await getCurrentUserContext();

  const { data: mensagem, error: mensagemError } = await supabase
    .from("messages")
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      direction: "saida",
      author_type: "humano",
      author_user_profile_id: userProfileId,
      message_type: "texto",
      body: textoLimpo,
      status: "pendente",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (mensagemError) {
    if (mensagemError.code === "23505") {
      // Mesma idempotency_key já gravada antes — reenvio (duplo clique/retry), não é erro.
      return { ok: true, message: "Mensagem já enviada." };
    }
    return { ok: false, message: `Não foi possível enviar: ${mensagemError.message}.` };
  }

  const { error: jobError } = await supabase.from("outbound_jobs").insert({
    company_id: companyId,
    conversation_id: conversationId,
    message_id: mensagem.id,
    idempotency_key: idempotencyKey,
  });

  if (jobError && jobError.code !== "23505") {
    return { ok: false, message: `Mensagem gravada, mas não foi possível enfileirar o envio: ${jobError.message}.` };
  }

  revalidatePath("/atendimento");
  return { ok: true, message: "Mensagem enviada." };
}

/** Nota interna — nunca gera outbound_jobs (bloqueado estruturalmente por trigger, além de nunca ser chamado aqui). */
export async function criarNotaInternaAction(conversationId: string, texto: string): Promise<AtendimentoActionState> {
  const textoLimpo = texto.trim();
  if (!textoLimpo) return { ok: false, message: "Nota vazia." };

  const { supabase, userProfileId, companyId } = await getCurrentUserContext();

  const { error } = await supabase.from("messages").insert({
    company_id: companyId,
    conversation_id: conversationId,
    direction: "saida",
    author_type: "humano",
    author_user_profile_id: userProfileId,
    is_internal_note: true,
    message_type: "nota",
    body: textoLimpo,
    status: "criada",
  });

  if (error) return { ok: false, message: `Não foi possível salvar a nota: ${error.message}.` };

  revalidatePath("/atendimento");
  return { ok: true, message: "Nota salva." };
}

/**
 * Assumir conversa — claim atômico via UPDATE ... WHERE assigned IS NULL.
 * Duas pessoas tentando assumir a mesma conversa: só a primeira UPDATE
 * afeta 1 linha; a segunda afeta 0 e recebe mensagem clara em vez de
 * "roubar" silenciosamente a atribuição.
 */
export async function assumirConversaAction(conversationId: string): Promise<AtendimentoActionState> {
  const { supabase, userProfileId, companyId } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("conversations")
    .update({ assigned_user_profile_id: userProfileId, status: "humano" })
    .eq("id", conversationId)
    .is("assigned_user_profile_id", null)
    .select("id");

  if (error) return { ok: false, message: `Não foi possível assumir: ${error.message}.` };
  if (!data || data.length === 0) {
    return { ok: false, message: "Esta conversa já foi assumida por outra pessoa." };
  }

  await supabase.from("conversation_transfers").insert({
    conversation_id: conversationId,
    company_id: companyId,
    from_user_profile_id: null,
    to_user_profile_id: userProfileId,
    transferred_by: userProfileId,
    note: "Assumida da fila",
  });

  revalidatePath("/atendimento");
  return { ok: true, message: "Conversa assumida." };
}

/**
 * Transferir conversa — RLS decide quem pode (admin/manager da empresa,
 * supervisor da equipe, ou o próprio responsável atual). Se a policy
 * bloquear, o UPDATE afeta 0 linhas silenciosamente — aqui isso vira
 * mensagem de erro explícita em vez de reportar sucesso falso.
 */
export async function transferirConversaAction(
  conversationId: string,
  paraUserProfileId: string,
  nota: string | null,
): Promise<AtendimentoActionState> {
  const { supabase, userProfileId, companyId } = await getCurrentUserContext();

  const { data: conversaAtual } = await supabase
    .from("conversations")
    .select("assigned_user_profile_id")
    .eq("id", conversationId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("conversations")
    .update({ assigned_user_profile_id: paraUserProfileId })
    .eq("id", conversationId)
    .select("id");

  if (error) return { ok: false, message: `Não foi possível transferir: ${error.message}.` };
  if (!data || data.length === 0) {
    return { ok: false, message: "Você não tem permissão para transferir esta conversa." };
  }

  await supabase.from("conversation_transfers").insert({
    conversation_id: conversationId,
    company_id: companyId,
    from_user_profile_id: conversaAtual?.assigned_user_profile_id ?? null,
    to_user_profile_id: paraUserProfileId,
    transferred_by: userProfileId,
    note: nota,
  });

  revalidatePath("/atendimento");
  return { ok: true, message: "Conversa transferida." };
}

export async function concluirConversaAction(conversationId: string): Promise<AtendimentoActionState> {
  const { supabase } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "encerrada" })
    .eq("id", conversationId)
    .select("id");

  if (error) return { ok: false, message: `Não foi possível concluir: ${error.message}.` };
  if (!data || data.length === 0) return { ok: false, message: "Você não tem acesso a esta conversa." };

  revalidatePath("/atendimento");
  return { ok: true, message: "Conversa concluída." };
}

/** Tenta reenviar uma mensagem que falhou — cria um NOVO job com idempotency_key nova, mesma mensagem. */
export async function reenviarMensagemFalhadaAction(messageId: string, conversationId: string): Promise<AtendimentoActionState> {
  const { supabase, companyId } = await getCurrentUserContext();

  const { data: mensagem, error: buscaError } = await supabase
    .from("messages")
    .select("id, status")
    .eq("id", messageId)
    .maybeSingle();

  if (buscaError || !mensagem) return { ok: false, message: "Mensagem não encontrada ou sem acesso." };
  if (mensagem.status !== "falha") return { ok: false, message: "Só é possível reenviar mensagens com falha." };

  await supabase.from("messages").update({ status: "pendente", failed_reason: null }).eq("id", messageId);

  const { error: jobError } = await supabase.from("outbound_jobs").insert({
    company_id: companyId,
    conversation_id: conversationId,
    message_id: messageId,
    idempotency_key: crypto.randomUUID(),
  });

  if (jobError) return { ok: false, message: `Não foi possível reenfileirar: ${jobError.message}.` };

  revalidatePath("/atendimento");
  return { ok: true, message: "Reenvio agendado." };
}

export async function reabrirConversaAction(conversationId: string): Promise<AtendimentoActionState> {
  const { supabase } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "aguardando_humano" })
    .eq("id", conversationId)
    .select("id");

  if (error) return { ok: false, message: `Não foi possível reabrir: ${error.message}.` };
  if (!data || data.length === 0) return { ok: false, message: "Você não tem acesso a esta conversa." };

  revalidatePath("/atendimento");
  return { ok: true, message: "Conversa reaberta." };
}
