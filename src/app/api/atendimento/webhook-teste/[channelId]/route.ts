import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterProvedorAtivo } from "@/lib/atendimento/registro-provedor";
import type { ConversationStatus } from "@/types/atendimento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint de ingestão de teste — recebe eventos do adaptador simulado (ou,
 * futuramente, de um adaptador de WhatsApp de teste de verdade) e persiste
 * mensagem/conversa/contato reais no banco. NUNCA é o mesmo caminho que os
 * dois números reais do WhatsApp vão usar — isso é decisão futura, exige
 * autorização explícita antes de conectar (ver docs/PROGRESS.md).
 *
 * Autenticação: header x-webhook-secret precisa bater com
 * ATENDIMENTO_WEBHOOK_TESTE_SECRET — sem essa variável configurada, o
 * endpoint recusa tudo (nunca aceita sem segredo configurado, mesmo em dev).
 *
 * Idempotência: cada evento tem um external_event_id; se o mesmo evento
 * chegar de novo (replay), a inserção em inbound_events bate na constraint
 * unique (channel_id, provider, external_event_id) e o endpoint responde
 * 200 sem reprocessar — replay nunca duplica mensagem/conversa.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const segredoEsperado = process.env.ATENDIMENTO_WEBHOOK_TESTE_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ error: "ATENDIMENTO_WEBHOOK_TESTE_SECRET não configurado no servidor." }, { status: 503 });
  }

  const segredoRecebido = request.headers.get("x-webhook-secret");
  if (segredoRecebido !== segredoEsperado) {
    return NextResponse.json({ error: "Segredo inválido." }, { status: 401 });
  }

  const { channelId } = await context.params;
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Corpo da requisição não é JSON válido." }, { status: 400 });
  }

  const provedor = obterProvedorAtivo();
  const evento = provedor.normalizarEventoWebhook(payload);
  if (!evento) {
    return NextResponse.json({ error: "Payload não reconhecido como evento de mensagem." }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: canal, error: canalError } = await admin
    .from("channels")
    .select("id, company_id")
    .eq("id", channelId)
    .maybeSingle();

  if (canalError || !canal) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }

  // Dedup por (channel_id, provider, external_event_id) — se já processado, responde OK sem refazer nada.
  const { error: eventoError } = await admin.from("inbound_events").insert({
    company_id: canal.company_id,
    channel_id: canal.id,
    provider: provedor.nome,
    external_event_id: evento.externalEventId,
    payload,
    processed_at: new Date().toISOString(),
  });

  if (eventoError) {
    if (eventoError.code === "23505") {
      return NextResponse.json({ ok: true, duplicado: true });
    }
    return NextResponse.json({ error: `Falha ao registrar evento: ${eventoError.message}` }, { status: 500 });
  }

  // Resolve contato pelo telefone (normalizado) — cria contato novo se o número ainda não existir nesta empresa.
  const { data: telefoneExistente } = await admin
    .from("contact_phone_numbers")
    .select("contact_id")
    .eq("company_id", canal.company_id)
    .eq("phone_e164", evento.contatoTelefone)
    .maybeSingle();

  let contatoId = telefoneExistente?.contact_id ?? null;

  if (!contatoId) {
    const { data: novoContato, error: contatoError } = await admin
      .from("contacts")
      .insert({ company_id: canal.company_id, display_name: evento.contatoNome })
      .select("id")
      .single();

    if (contatoError || !novoContato) {
      return NextResponse.json({ error: `Falha ao criar contato: ${contatoError?.message}` }, { status: 500 });
    }

    contatoId = novoContato.id;

    await admin.from("contact_phone_numbers").insert({
      contact_id: contatoId,
      company_id: canal.company_id,
      phone_e164: evento.contatoTelefone,
      is_primary: true,
    });
  }

  // Conversa aberta existente (não encerrada) nesse canal+contato, ou cria uma nova.
  const { data: conversaExistente } = await admin
    .from("conversations")
    .select("id, status, unread_count")
    .eq("company_id", canal.company_id)
    .eq("channel_id", canal.id)
    .eq("contact_id", contatoId)
    .neq("status", "encerrada")
    .maybeSingle();

  let conversaId = conversaExistente?.id ?? null;

  if (!conversaId) {
    const { data: novaConversa, error: conversaError } = await admin
      .from("conversations")
      .insert({
        company_id: canal.company_id,
        channel_id: canal.id,
        contact_id: contatoId,
        status: "aguardando_humano",
      })
      .select("id")
      .single();

    if (conversaError || !novaConversa) {
      return NextResponse.json({ error: `Falha ao criar conversa: ${conversaError?.message}` }, { status: 500 });
    }

    conversaId = novaConversa.id;
  } else {
    const novoStatus: ConversationStatus = conversaExistente!.status === "humano" ? "humano" : "aguardando_humano";
    await admin.from("conversations").update({ status: novoStatus }).eq("id", conversaId);
  }

  const { data: mensagem, error: mensagemError } = await admin
    .from("messages")
    .insert({
      company_id: canal.company_id,
      conversation_id: conversaId,
      direction: "entrada",
      author_type: "cliente",
      message_type: evento.tipo,
      body: evento.texto,
      status: "recebida",
      external_id: evento.externalMessageId,
    })
    .select("id")
    .single();

  if (mensagemError || !mensagem) {
    return NextResponse.json({ error: `Falha ao gravar mensagem: ${mensagemError?.message}` }, { status: 500 });
  }

  await admin
    .from("conversations")
    .update({
      last_activity_at: evento.timestamp,
      last_message_preview: evento.texto?.slice(0, 200) ?? `[${evento.tipo}]`,
      unread_count: (conversaExistente?.unread_count ?? 0) + 1,
    })
    .eq("id", conversaId);

  return NextResponse.json({ ok: true, conversationId: conversaId, messageId: mensagem.id });
}
