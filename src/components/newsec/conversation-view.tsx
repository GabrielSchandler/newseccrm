"use client";

import { useEffect, useState } from "react";
import { FileText, Paperclip, Phone, Play, Send, StickyNote } from "lucide-react";
import type { ConversaDemo } from "@/lib/demo/atendimento-data";
import { EstadoBadge } from "./estado-badge";

export function ConversationView({
  conversa,
  rascunho,
  onRascunhoChange,
  onEnviar,
}: {
  conversa: ConversaDemo;
  /** Controlado pelo componente pai (por conversa) — ver atendimento-workspace.tsx. */
  rascunho: string;
  onRascunhoChange: (texto: string) => void;
  onEnviar: () => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);

  // Sem componente sendo remontado por conversa (nao ha mais `key`), o aviso
  // efemero de envio precisa ser limpo manualmente ao trocar de conversa.
  useEffect(() => {
    setAviso(null);
  }, [conversa.id]);

  function enviarDemo(event: React.FormEvent) {
    event.preventDefault();
    if (!rascunho.trim()) return;
    setAviso("Modo de demonstração: nada foi enviado de verdade.");
    onEnviar();
    window.setTimeout(() => setAviso(null), 3000);
  }

  return (
    <div className="flex h-full min-w-[420px] flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ns-border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-sm font-semibold text-[var(--ns-primary)]">
            {conversa.nome
              .split(" ")
              .slice(0, 2)
              .map((parte) => parte[0])
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ns-text)]">{conversa.nome}</p>
            <p className="truncate text-xs text-[var(--ns-text-secondary)]">
              {conversa.canal} · {conversa.numeroCanal}
              {conversa.responsavel ? ` · ${conversa.responsavel}` : " · sem responsável"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <EstadoBadge estado={conversa.estado} />
          <button
            type="button"
            title="Transferir (demonstração)"
            className="rounded-lg border border-[var(--ns-border)] px-3 py-1.5 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            Transferir
          </button>
          <button
            type="button"
            title="Concluir (demonstração)"
            className="rounded-lg bg-[var(--ns-primary)] px-3 py-1.5 text-xs font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90"
          >
            {conversa.estado === "ENCERRADA" ? "Reabrir" : "Concluir"}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversa.mensagens.map((mensagem) => {
          if (mensagem.tipo === "nota") {
            return (
              <div
                key={mensagem.id}
                className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-[var(--ns-warning)]/40 bg-[var(--ns-warning)]/10 px-3 py-2 text-xs text-[var(--ns-text)]"
              >
                <StickyNote aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ns-warning)]" />
                <div>
                  <p className="font-medium">Nota interna — nunca vai para o cliente</p>
                  <p className="text-[var(--ns-text-secondary)]">{mensagem.texto}</p>
                </div>
              </div>
            );
          }

          const doCliente = mensagem.autor === "cliente";

          return (
            <div key={mensagem.id} className={`flex ${doCliente ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                  doCliente
                    ? "bg-[var(--ns-surface-hover)] text-[var(--ns-text)]"
                    : "bg-[var(--ns-primary)] text-[var(--ns-primary-foreground)]"
                }`}
              >
                {mensagem.tipo === "documento" ? (
                  <div className="flex items-center gap-2">
                    <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="underline">{mensagem.nomeArquivo}</span>
                  </div>
                ) : mensagem.tipo === "audio" ? (
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Reproduzir (demonstração)"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          doCliente ? "bg-[var(--ns-primary)] text-white" : "bg-white/20 text-white"
                        }`}
                      >
                        <Play aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex h-6 flex-1 items-center gap-0.5">
                        {Array.from({ length: 24 }).map((_, index) => (
                          <span
                            key={index}
                            className={`w-0.5 rounded-full ${doCliente ? "bg-[var(--ns-text-secondary)]" : "bg-white/60"}`}
                            style={{ height: `${((index * 7) % 18) + 4}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] shrink-0">{mensagem.duracao}</span>
                    </div>
                    <p
                      className={`mt-1.5 text-xs italic ${doCliente ? "text-[var(--ns-text-secondary)]" : "text-[var(--ns-primary-foreground)]/80"}`}
                    >
                      Transcrição: &ldquo;{mensagem.texto}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p>{mensagem.texto}</p>
                )}
                <p
                  className={`mt-1 text-right text-[10px] ${
                    doCliente ? "text-[var(--ns-text-secondary)]" : "text-[var(--ns-primary-foreground)]/70"
                  }`}
                >
                  {mensagem.hora}
                </p>
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

      <form onSubmit={enviarDemo} className="flex items-center gap-2 border-t border-[var(--ns-border)] p-3">
        <button
          type="button"
          title="Registrar ligação (demonstração)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ns-border)] text-[var(--ns-text-secondary)] transition hover:bg-[var(--ns-surface-hover)]"
        >
          <Phone aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Anexar arquivo (demonstração)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ns-border)] text-[var(--ns-text-secondary)] transition hover:bg-[var(--ns-surface-hover)]"
        >
          <Paperclip aria-hidden="true" className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={rascunho}
          onChange={(event) => onRascunhoChange(event.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
        />
        <button
          type="submit"
          title="Enviar (demonstração)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ns-primary)] text-[var(--ns-primary-foreground)] transition hover:opacity-90"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
