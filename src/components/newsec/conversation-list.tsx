"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ConversaDemo } from "@/lib/demo/atendimento-data";
import { EstadoBadge } from "./estado-badge";

type Aba = "meus" | "equipe" | "ia";

function filtrarPorAba(lista: ConversaDemo[], aba: Aba) {
  return lista.filter((conversa) => {
    if (aba === "ia") return conversa.estado === "IA";
    if (aba === "equipe") return conversa.responsavel !== "Você";
    return conversa.responsavel === "Você";
  });
}

export function ConversationList({
  conversas,
  selecionadaId,
  onSelecionar,
}: {
  conversas: ConversaDemo[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
}) {
  const [aba, setAba] = useState<Aba>("meus");
  const [busca, setBusca] = useState("");

  const contagens = {
    meus: filtrarPorAba(conversas, "meus").length,
    equipe: filtrarPorAba(conversas, "equipe").length,
    ia: filtrarPorAba(conversas, "ia").length,
  };

  const filtradas = useMemo(() => {
    return filtrarPorAba(conversas, aba).filter((conversa) => {
      if (busca.trim() && !conversa.nome.toLowerCase().includes(busca.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [conversas, aba, busca]);

  return (
    <div className="flex h-full w-full flex-col border-r border-[var(--ns-border)]">
      <div className="border-b border-[var(--ns-border)] px-3 pt-3">
        <h1 className="text-lg font-semibold text-[var(--ns-text)]">Atendimento</h1>
        <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">Converse, organize e avance com seus clientes.</p>
      </div>
      <div className="flex flex-col gap-3 border-b border-[var(--ns-border)] p-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-secondary)]"
          />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar conversas..."
            className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] py-2 pl-8 pr-3 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-[var(--ns-surface-hover)] p-1 text-sm">
          {(
            [
              ["meus", "Meus", contagens.meus],
              ["equipe", "Equipe", contagens.equipe],
              ["ia", "IA", contagens.ia],
            ] as const
          ).map(([value, label, contagem]) => (
            <button
              key={value}
              type="button"
              onClick={() => setAba(value)}
              className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
                aba === value
                  ? "bg-[var(--ns-surface)] text-[var(--ns-text)] shadow-sm"
                  : "text-[var(--ns-text-secondary)] hover:text-[var(--ns-text)]"
              }`}
            >
              {label} {contagem}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtradas.length === 0 ? (
          <li className="p-6 text-center text-sm text-[var(--ns-text-secondary)]">
            Nenhuma conversa nesse filtro.
          </li>
        ) : (
          filtradas.map((conversa) => (
            <li key={conversa.id}>
              <button
                type="button"
                onClick={() => onSelecionar(conversa.id)}
                aria-current={conversa.id === selecionadaId}
                className={`flex w-full flex-col gap-1 border-b border-[var(--ns-border)] px-3 py-3 text-left transition ${
                  conversa.id === selecionadaId
                    ? "bg-[var(--ns-primary)]/10"
                    : "hover:bg-[var(--ns-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--ns-text)]">
                    {conversa.nome}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--ns-text-secondary)]">
                    {conversa.ultimaAtividade}
                  </span>
                </div>
                <span className="truncate text-xs text-[var(--ns-text-secondary)]">
                  {conversa.trecho}
                </span>
                <div className="flex items-center gap-2">
                  <EstadoBadge estado={conversa.estado} />
                  <span className="text-[11px] text-[var(--ns-text-secondary)]">
                    {conversa.canal} · {conversa.numeroCanal}
                  </span>
                  {conversa.naoLidas > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ns-primary)] px-1 text-[11px] font-semibold text-[var(--ns-primary-foreground)]">
                      {conversa.naoLidas}
                    </span>
                  )}
                  {conversa.esperaMinutos !== null && conversa.esperaMinutos > 60 && (
                    <span className="ml-auto text-[11px] font-medium text-[var(--ns-danger)]">
                      espera {Math.round(conversa.esperaMinutos / 60)}h
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
