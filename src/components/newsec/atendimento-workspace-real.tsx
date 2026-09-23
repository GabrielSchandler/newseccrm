"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, Phone, RefreshCw, Send, StickyNote, UserPlus, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { ConversaEstado } from "@/lib/demo/atendimento-data";
import type { ConversationStatus, Message } from "@/types/atendimento";
import {
  assumirConversaAction,
  concluirConversaAction,
  criarNotaInternaAction,
  enviarMensagemAction,
  reabrirConversaAction,
  reenviarMensagemFalhadaAction,
  transferirConversaAction,
} from "@/app/(newsec)/atendimento/actions";
import { EstadoBadge } from "./estado-badge";

type ConversaLista = {
  id: string;
  status: ConversationStatus;
  last_activity_at: string;
  last_message_preview: string | null;
  unread_count: number;
  assigned_user_profile_id: string | null;
  client_id: string | null;
  contact: { id: string; display_name: string | null } | null;
  channel: { id: string; name: string } | null;
  assigned_user_profile: { id: string; full_name: string | null } | null;
};

type UsuarioEmpresa = { id: string; full_name: string | null };

const STATUS_PARA_BADGE: Record<ConversationStatus, ConversaEstado> = {
  ia: "IA",
  aguardando_humano: "AGUARDANDO_HUMANO",
  humano: "HUMANO",
  aguardando_cliente: "AGUARDANDO_CLIENTE",
  encerrada: "ENCERRADA",
};

type Aba = "meus" | "equipe";

function iniciaisDe(nome: string | null) {
  if (!nome) return "?";
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export function AtendimentoWorkspaceReal({
  companyId,
  userProfileId,
  isAdminOuManager,
}: {
  companyId: string;
  userProfileId: string;
  isAdminOuManager: boolean;
  isPlatformOwner: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aba, setAba] = useState<Aba>("meus");
  const [busca, setBusca] = useState("");
  const [conversas, setConversas] = useState<ConversaLista[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Message[] | null>(null);
  const [erroMensagens, setErroMensagens] = useState<string | null>(null);

  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [modoNota, setModoNota] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<UsuarioEmpresa[]>([]);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);

  const carregarConversas = useCallback(async () => {
    setCarregandoLista(true);
    setErroLista(null);

    let query = supabase
      .from("conversations")
      .select(
        "id, status, last_activity_at, last_message_preview, unread_count, assigned_user_profile_id, client_id, " +
          "contact:contacts(id, display_name), channel:channels(id, name), " +
          "assigned_user_profile:user_profiles!conversations_assigned_user_profile_id_fkey(id, full_name)",
      )
      .order("last_activity_at", { ascending: false })
      .limit(50);

    if (aba === "meus") {
      query = query.eq("assigned_user_profile_id", userProfileId);
    }

    const { data, error } = await query;

    if (error) {
      setErroLista(`Não foi possível carregar as conversas: ${error.message}`);
      setConversas(null);
    } else {
      setConversas((data ?? []) as unknown as ConversaLista[]);
    }
    setCarregandoLista(false);
  }, [supabase, aba, userProfileId]);

  const carregarMensagens = useCallback(
    async (conversationId: string) => {
      setErroMensagens(null);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        setErroMensagens(`Não foi possível carregar as mensagens: ${error.message}`);
        setMensagens(null);
      } else {
        setMensagens((data ?? []) as Message[]);
      }
    },
    [supabase],
  );

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  useEffect(() => {
    if (selecionadaId) carregarMensagens(selecionadaId);
  }, [selecionadaId, carregarMensagens]);

  useEffect(() => {
    if (!selecionadaId && conversas && conversas.length > 0) {
      setSelecionadaId(conversas[0].id);
    }
  }, [conversas, selecionadaId]);

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .then(({ data }) => setUsuariosEmpresa((data ?? []) as UsuarioEmpresa[]));
  }, [supabase, companyId]);

  const conversaSelecionada = conversas?.find((c) => c.id === selecionadaId) ?? null;

  const conversasFiltradas = useMemo(() => {
    if (!conversas) return [];
    if (!busca.trim()) return conversas;
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) => c.contact?.display_name?.toLowerCase().includes(termo));
  }, [conversas, busca]);

  function mostrarAviso(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 4000);
  }

  async function handleEnviar(event: React.FormEvent) {
    event.preventDefault();
    if (!selecionadaId) return;
    const texto = rascunhos[selecionadaId] ?? "";
    if (!texto.trim()) return;

    setEnviando(true);
    const resultado = modoNota
      ? await criarNotaInternaAction(selecionadaId, texto)
      : await enviarMensagemAction(selecionadaId, texto, crypto.randomUUID());
    setEnviando(false);
    mostrarAviso(resultado.message);

    if (resultado.ok) {
      setRascunhos((atual) => ({ ...atual, [selecionadaId]: "" }));
      await carregarMensagens(selecionadaId);
      await carregarConversas();
    }
  }

  async function handleAssumir() {
    if (!selecionadaId) return;
    const resultado = await assumirConversaAction(selecionadaId);
    mostrarAviso(resultado.message);
    await carregarConversas();
  }

  async function handleTransferir(paraUserProfileId: string) {
    if (!selecionadaId) return;
    const resultado = await transferirConversaAction(selecionadaId, paraUserProfileId, null);
    mostrarAviso(resultado.message);
    setTransferenciaAberta(false);
    await carregarConversas();
  }

  async function handleConcluirOuReabrir() {
    if (!selecionadaId || !conversaSelecionada) return;
    const resultado =
      conversaSelecionada.status === "encerrada"
        ? await reabrirConversaAction(selecionadaId)
        : await concluirConversaAction(selecionadaId);
    mostrarAviso(resultado.message);
    await carregarConversas();
  }

  async function handleReenviar(messageId: string) {
    if (!selecionadaId) return;
    const resultado = await reenviarMensagemFalhadaAction(messageId, selecionadaId);
    mostrarAviso(resultado.message);
    await carregarMensagens(selecionadaId);
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--ns-border)]">
        <div className="border-b border-[var(--ns-border)] px-3 pt-3">
          <h1 className="text-lg font-semibold text-[var(--ns-text)]">Atendimento</h1>
          <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">Conversas reais — sem dado fictício.</p>
        </div>
        <div className="flex flex-col gap-3 border-b border-[var(--ns-border)] p-3">
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome do contato..."
            className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
          />
          <div className="flex gap-1 rounded-lg bg-[var(--ns-surface-hover)] p-1 text-sm">
            {(["meus", "equipe"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setAba(valor)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium capitalize transition ${
                  aba === valor ? "bg-[var(--ns-surface)] text-[var(--ns-text)] shadow-sm" : "text-[var(--ns-text-secondary)] hover:text-[var(--ns-text)]"
                }`}
              >
                {valor === "meus" ? "Meus" : "Equipe"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregandoLista && <p className="p-4 text-sm text-[var(--ns-text-secondary)]">Carregando...</p>}
          {erroLista && (
            <p className="m-3 rounded-lg border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 p-2.5 text-xs text-[var(--ns-danger)]">
              {erroLista}
            </p>
          )}
          {!carregandoLista && !erroLista && conversasFiltradas.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--ns-text-secondary)]">Nenhuma conversa nesse filtro.</p>
          )}
          {conversasFiltradas.map((conversa) => (
            <button
              key={conversa.id}
              type="button"
              onClick={() => setSelecionadaId(conversa.id)}
              className={`flex w-full flex-col gap-1 border-b border-[var(--ns-border)] px-3 py-3 text-left transition ${
                conversa.id === selecionadaId ? "bg-[var(--ns-primary)]/10" : "hover:bg-[var(--ns-surface-hover)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-[var(--ns-text)]">
                  {conversa.contact?.display_name ?? "Contato sem nome"}
                </span>
                <span className="shrink-0 text-xs text-[var(--ns-text-secondary)]">
                  {new Date(conversa.last_activity_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <span className="truncate text-xs text-[var(--ns-text-secondary)]">{conversa.last_message_preview ?? "—"}</span>
              <div className="flex items-center gap-2">
                <EstadoBadge estado={STATUS_PARA_BADGE[conversa.status]} />
                <span className="text-[11px] text-[var(--ns-text-secondary)]">{conversa.channel?.name ?? "Canal"}</span>
                {conversa.unread_count > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ns-primary)] px-1 text-[11px] font-semibold text-[var(--ns-primary-foreground)]">
                    {conversa.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-full min-w-[420px] flex-1 flex-col">
        {!conversaSelecionada ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--ns-text-secondary)]">
            Selecione uma conversa.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ns-border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-sm font-semibold text-[var(--ns-primary)]">
                  {iniciaisDe(conversaSelecionada.contact?.display_name ?? null)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ns-text)]">
                    {conversaSelecionada.contact?.display_name ?? "Contato sem nome"}
                  </p>
                  <p className="truncate text-xs text-[var(--ns-text-secondary)]">
                    {conversaSelecionada.channel?.name ?? "Canal"} ·{" "}
                    {conversaSelecionada.assigned_user_profile?.full_name ?? "sem responsável"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EstadoBadge estado={STATUS_PARA_BADGE[conversaSelecionada.status]} />
                {!conversaSelecionada.assigned_user_profile_id && (
                  <button
                    type="button"
                    onClick={handleAssumir}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                  >
                    <UserPlus aria-hidden="true" className="h-3.5 w-3.5" />
                    Assumir
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTransferenciaAberta((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                  >
                    <Users2 aria-hidden="true" className="h-3.5 w-3.5" />
                    Transferir
                  </button>
                  {transferenciaAberta && (
                    <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] p-1.5 shadow-lg">
                      {usuariosEmpresa
                        .filter((u) => u.id !== conversaSelecionada.assigned_user_profile_id)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleTransferir(u.id)}
                            className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-[var(--ns-text)] hover:bg-[var(--ns-surface-hover)]"
                          >
                            {u.full_name ?? u.id}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConcluirOuReabrir}
                  className="rounded-lg bg-[var(--ns-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90"
                >
                  {conversaSelecionada.status === "encerrada" ? "Reabrir" : "Concluir"}
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {erroMensagens && (
                <p className="mx-auto max-w-md rounded-lg border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-3 py-2 text-xs text-[var(--ns-danger)]">
                  {erroMensagens}
                </p>
              )}
              {mensagens?.length === 0 && (
                <p className="text-center text-sm text-[var(--ns-text-secondary)]">Nenhuma mensagem ainda.</p>
              )}
              {mensagens?.map((mensagem) => {
                if (mensagem.is_internal_note) {
                  return (
                    <div
                      key={mensagem.id}
                      className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-[var(--ns-warning)]/40 bg-[var(--ns-warning)]/10 px-3 py-2 text-xs text-[var(--ns-text)]"
                    >
                      <StickyNote aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ns-warning)]" />
                      <div>
                        <p className="font-medium">Nota interna — nunca vai para o cliente</p>
                        <p className="text-[var(--ns-text-secondary)]">{mensagem.body}</p>
                      </div>
                    </div>
                  );
                }

                const doCliente = mensagem.direction === "entrada";
                return (
                  <div key={mensagem.id} className={`flex ${doCliente ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        doCliente ? "bg-[var(--ns-surface-hover)] text-[var(--ns-text)]" : "bg-[var(--ns-primary)] text-[var(--ns-primary-foreground)]"
                      }`}
                    >
                      {mensagem.message_type === "documento" ? (
                        <div className="flex items-center gap-2">
                          <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                          <span className="underline">{mensagem.body ?? "documento"}</span>
                        </div>
                      ) : (
                        <p>{mensagem.body}</p>
                      )}
                      <div
                        className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                          doCliente ? "text-[var(--ns-text-secondary)]" : "text-[var(--ns-primary-foreground)]/70"
                        }`}
                      >
                        {!doCliente && mensagem.status === "falha" && (
                          <button
                            type="button"
                            onClick={() => handleReenviar(mensagem.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--ns-danger)]/20 px-1.5 py-0.5 text-[var(--ns-danger)]"
                            title={mensagem.failed_reason ?? "Falha no envio"}
                          >
                            <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                            Falhou — tentar de novo
                          </button>
                        )}
                        {!doCliente && mensagem.status === "pendente" && <span>enviando...</span>}
                        {!doCliente && (mensagem.status === "enviada" || mensagem.status === "entregue" || mensagem.status === "lida") && (
                          <Check aria-hidden="true" className="h-3 w-3" />
                        )}
                        <span>{new Date(mensagem.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {aviso && (
              <div className="px-4 pb-1 text-xs text-[var(--ns-text-secondary)]" role="status">
                {aviso}
              </div>
            )}

            <form onSubmit={handleEnviar} className="border-t border-[var(--ns-border)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModoNota(false)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${!modoNota ? "bg-[var(--ns-primary)]/15 text-[var(--ns-primary)]" : "text-[var(--ns-text-secondary)]"}`}
                >
                  Mensagem
                </button>
                <button
                  type="button"
                  onClick={() => setModoNota(true)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${modoNota ? "bg-[var(--ns-warning)]/15 text-[var(--ns-warning)]" : "text-[var(--ns-text-secondary)]"}`}
                >
                  Nota interna
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Registrar ligação (ainda não implementado nesta entrega)"
                  disabled
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ns-border)] text-[var(--ns-text-secondary)] opacity-50"
                >
                  <Phone aria-hidden="true" className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={rascunhos[selecionadaId ?? ""] ?? ""}
                  onChange={(event) =>
                    setRascunhos((atual) => ({ ...atual, [selecionadaId ?? ""]: event.target.value }))
                  }
                  placeholder={modoNota ? "Escreva uma nota interna..." : "Digite uma mensagem..."}
                  className="flex-1 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
                />
                <button
                  type="submit"
                  disabled={enviando}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ns-primary)] text-[var(--ns-primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <aside className="hidden h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[var(--ns-border)] p-4 lg:flex">
        {!conversaSelecionada ? (
          <p className="text-sm text-[var(--ns-text-secondary)]">Selecione uma conversa.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-sm font-semibold text-[var(--ns-primary)]">
                {iniciaisDe(conversaSelecionada.contact?.display_name ?? null)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--ns-text)]">
                  {conversaSelecionada.contact?.display_name ?? "Contato sem nome"}
                </p>
                <p className={`text-xs ${conversaSelecionada.client_id ? "text-[var(--ns-success)]" : "text-[var(--ns-warning)]"}`}>
                  {conversaSelecionada.client_id ? "Cliente cadastrado" : "Contato · cadastro pendente"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => carregarConversas()}
              className="mb-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ns-border)] px-3 py-2 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Atualizar
            </button>
            <div className="mb-4 rounded-lg border border-dashed border-[var(--ns-border)] p-3 text-xs text-[var(--ns-text-secondary)]">
              Resumo automático, pré-venda, pós-venda e ações de cadastro/análise ainda não estão integrados nesta
              entrega (dependem da Entrega D — ações do CRM no atendimento). O que aparece aqui é dado real do banco.
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]">Canal</div>
            <p className="mb-4 text-xs text-[var(--ns-text)]">{conversaSelecionada.channel?.name ?? "—"}</p>
            {isAdminOuManager && (
              <p className="text-xs text-[var(--ns-text-secondary)]">
                Você vê todas as conversas da empresa (admin/gerente). Consultores veem só as próprias + a fila da
                equipe.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
