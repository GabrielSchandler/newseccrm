"use client";

import { useState } from "react";
import { GripVertical, MoreVertical, Search, X } from "lucide-react";
import {
  cardsEditorDemo,
  catalogoIndicadoresDemo,
  configuracaoDemoPorCard,
  type CardDashboardDemo,
} from "@/lib/demo/editor-dashboards-data";
import { MiniBarChart, MiniDonutChart, MiniLineChart } from "./mini-charts";

function CardPreview({ card }: { card: CardDashboardDemo }) {
  return (
    <>
      {card.valorPrincipal && (
        <div className="mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-[var(--ns-text)]">{card.valorPrincipal}</span>
            {card.variacao && (
              <span className="text-xs font-medium text-[var(--ns-success)]">{card.variacao}</span>
            )}
          </div>
          {card.legenda && <p className="text-xs text-[var(--ns-text-secondary)]">{card.legenda}</p>}
        </div>
      )}

      {card.tipo === "linha" && card.serieLinha && (
        <MiniLineChart valores={card.serieLinha} rotulos={card.rotulosLinha ?? []} />
      )}
      {card.tipo === "barra" && card.serieBarra && (
        <MiniBarChart valores={card.serieBarra} rotulos={card.rotulosBarra ?? []} />
      )}
      {card.tipo === "donut" && card.donut && (
        <div className="flex items-center gap-4">
          <MiniDonutChart percentual={card.donut.percentual} />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ns-primary)]" />
              Convertidos <span className="font-semibold text-[var(--ns-text)]">{card.donut.convertidos}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--ns-surface-hover)] ring-1 ring-[var(--ns-border)]" />
              Não convertidos <span className="font-semibold text-[var(--ns-text)]">{card.donut.naoConvertidos}</span>
            </div>
            <div className="border-t border-[var(--ns-border)] pt-1 text-[var(--ns-text-secondary)]">
              Total <span className="font-semibold text-[var(--ns-text)]">{card.donut.total}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditorDashboardsWorkspace() {
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>("conversao_contatos");
  const cardSelecionado = cardsEditorDemo.find((c) => c.id === cardSelecionadoId) ?? null;
  const config = cardSelecionadoId ? configuracaoDemoPorCard[cardSelecionadoId] : null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-[var(--ns-border)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Indicadores</h2>
        <div className="relative mb-3">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ns-text-secondary)]"
          />
          <input
            type="search"
            placeholder="Buscar indicadores..."
            className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] py-2 pl-8 pr-3 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
          />
        </div>
        <ul className="space-y-2">
          {catalogoIndicadoresDemo.map((indicador) => (
            <li
              key={indicador.id}
              title="Arrastar pra grade (demonstração)"
              className="flex cursor-grab items-start gap-2 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] p-2.5 text-xs transition hover:bg-[var(--ns-surface-hover)]"
            >
              <GripVertical aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ns-text-secondary)]" />
              <div>
                <p className="font-medium text-[var(--ns-text)]">{indicador.nome}</p>
                <p className="text-[var(--ns-text-secondary)]">{indicador.descricao}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-dashed border-[var(--ns-border)] p-3 text-xs text-[var(--ns-text-secondary)]">
          Arraste os indicadores para o painel ao lado. Você pode reposicionar e redimensionar os
          cards livremente.
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cardsEditorDemo.map((card) => {
            const selecionado = card.id === cardSelecionadoId;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setCardSelecionadoId(card.id)}
                className={`rounded-xl border bg-[var(--ns-surface)] p-4 text-left transition ${
                  selecionado
                    ? "border-[var(--ns-primary)] ring-2 ring-[var(--ns-primary)]"
                    : "border-[var(--ns-border)] hover:border-[var(--ns-primary)]/50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ns-text)]">{card.titulo}</h3>
                  <MoreVertical aria-hidden="true" className="h-4 w-4 text-[var(--ns-text-secondary)]" />
                </div>
                <CardPreview card={card} />
              </button>
            );
          })}
        </div>
      </div>

      {config && cardSelecionado && (
        <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[var(--ns-border)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--ns-text)]">Configurar indicador</h2>
            <button
              type="button"
              onClick={() => setCardSelecionadoId(null)}
              aria-label="Fechar configuração"
              className="rounded-lg p-1 text-[var(--ns-text-secondary)] hover:bg-[var(--ns-surface-hover)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">Nome</span>
              <input
                readOnly
                defaultValue={config.nome}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-sm text-[var(--ns-text)] outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">Tipo de indicador</span>
              <input
                readOnly
                defaultValue={config.tipo}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-sm text-[var(--ns-text)] outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">Período</span>
              <input
                readOnly
                defaultValue={config.periodo}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-sm text-[var(--ns-text)] outline-none"
              />
            </label>

            <div>
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">Fórmula do indicador</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] p-2">
                <span className="rounded bg-[var(--ns-primary)]/15 px-2 py-1 text-xs font-medium text-[var(--ns-primary)]">
                  {config.formulaNumerador}
                </span>
                {config.formulaDenominador && (
                  <>
                    <span className="text-[var(--ns-text-secondary)]">/</span>
                    <span className="rounded bg-[var(--ns-primary)]/15 px-2 py-1 text-xs font-medium text-[var(--ns-primary)]">
                      {config.formulaDenominador}
                    </span>
                  </>
                )}
              </div>
              {config.multiplicador !== "1" && (
                <p className="mt-1.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-xs text-[var(--ns-text)]">
                  × {config.multiplicador}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[var(--ns-text-secondary)]">
                Fórmula vem de um catálogo validado — sem SQL ou JavaScript livre.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">
                Exibição quando não houver dados
              </span>
              <input
                readOnly
                defaultValue={config.exibicaoSemDados}
                className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-sm text-[var(--ns-text)] outline-none"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--ns-text-secondary)]">Compartilhamento</span>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 rounded-lg border border-[var(--ns-border)] p-2.5">
                  <input
                    type="radio"
                    checked={config.compartilhamento === "pessoal"}
                    readOnly
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    <span className="block font-medium text-[var(--ns-text)]">Só para mim</span>
                    <span className="text-[var(--ns-text-secondary)]">Apenas você pode ver este indicador</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-[var(--ns-border)] p-2.5">
                  <input
                    type="radio"
                    checked={config.compartilhamento === "empresa"}
                    readOnly
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    <span className="block font-medium text-[var(--ns-text)]">Empresa</span>
                    <span className="text-[var(--ns-text-secondary)]">Todos na empresa podem ver</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--ns-text-secondary)]">Tamanho do card</span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(["compacto", "largo", "alto"] as const).map((tamanho) => (
                  <div
                    key={tamanho}
                    className={`rounded-lg border p-2 ${
                      config.tamanhoCard === tamanho
                        ? "border-[var(--ns-primary)] bg-[var(--ns-primary)]/10 text-[var(--ns-primary)]"
                        : "border-[var(--ns-border)] text-[var(--ns-text-secondary)]"
                    }`}
                  >
                    {tamanho === "compacto" ? "1x1" : tamanho === "largo" ? "2x1" : "1x2"}
                    <p className="mt-0.5 capitalize">{tamanho}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
