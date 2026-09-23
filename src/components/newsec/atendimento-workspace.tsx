"use client";

import { useState } from "react";
import { conversasDemo } from "@/lib/demo/atendimento-data";
import { ConversationList } from "./conversation-list";
import { ConversationView } from "./conversation-view";
import { ContextPanel } from "./context-panel";
import { PreSaleDrawer } from "./pre-sale-drawer";

export function AtendimentoWorkspace() {
  const [selecionadaId, setSelecionadaId] = useState(conversasDemo[0].id);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [contextoRecolhido, setContextoRecolhido] = useState(false);
  // Rascunho vive aqui, fora do ciclo de vida do ConversationView, e
  // indexado por conversa — trocar de conversa e voltar preserva o texto
  // de cada uma em vez de perder tudo (o componente antes guardava isso em
  // useState proprio + `key={conversa.id}`, que forcava remontagem e
  // descartava o rascunho a cada troca).
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const conversa = conversasDemo.find((item) => item.id === selecionadaId) ?? conversasDemo[0];

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="w-[300px] shrink-0">
        <ConversationList
          conversas={conversasDemo}
          selecionadaId={selecionadaId}
          onSelecionar={(id) => {
            setSelecionadaId(id);
            setDrawerAberto(false);
          }}
        />
      </div>

      <ConversationView
        conversa={conversa}
        rascunho={rascunhos[conversa.id] ?? ""}
        onRascunhoChange={(texto) =>
          setRascunhos((atual) => ({ ...atual, [conversa.id]: texto }))
        }
        onEnviar={() => setRascunhos((atual) => ({ ...atual, [conversa.id]: "" }))}
      />

      <div className="hidden shrink-0 lg:block" style={{ width: contextoRecolhido ? 0 : 340 }}>
        {!contextoRecolhido && (
          <ContextPanel conversa={conversa} onAbrirPreVenda={() => setDrawerAberto(true)} />
        )}
      </div>

      <button
        type="button"
        onClick={() => setContextoRecolhido((value) => !value)}
        title={contextoRecolhido ? "Mostrar painel do cliente" : "Recolher painel do cliente"}
        className="hidden w-6 shrink-0 items-center justify-center border-l border-[var(--ns-border)] text-[var(--ns-text-secondary)] transition hover:bg-[var(--ns-surface-hover)] lg:flex"
      >
        {contextoRecolhido ? "‹" : "›"}
      </button>

      <PreSaleDrawer
        aberto={drawerAberto}
        nomeCliente={conversa.nome}
        onFechar={() => setDrawerAberto(false)}
      />
    </div>
  );
}
