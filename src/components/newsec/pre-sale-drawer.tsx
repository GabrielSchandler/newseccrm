"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { secoesPreVendaDemo } from "@/lib/demo/atendimento-data";

type Estado = "idle" | "salvando" | "erro";

export function PreSaleDrawer({
  aberto,
  nomeCliente,
  onFechar,
}: {
  aberto: boolean;
  nomeCliente: string;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>("idle");

  if (!aberto) return null;

  function salvarDemo() {
    setEstado("salvando");
    window.setTimeout(() => {
      // Demonstração determinística: sempre mostra o estado de erro
      // recuperável, porque não há backend real nesta fase (Fase 1) — a
      // gravação de verdade entra na Fase 3, ligada às actions reais do CRM.
      setEstado("erro");
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-pre-venda-titulo"
        className="relative flex h-full w-full max-w-md flex-col bg-[var(--ns-surface)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--ns-border)] px-4 py-3">
          <div>
            <h2 id="drawer-pre-venda-titulo" className="text-sm font-semibold text-[var(--ns-text)]">
              Criar pré-venda
            </h2>
            <p className="text-xs text-[var(--ns-text-secondary)]">{nomeCliente} · Cliente cadastrado</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar drawer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ns-text-secondary)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface-hover)] px-3 py-2 text-xs text-[var(--ns-text-secondary)]">
            As seções e campos abaixo são os mesmos de{" "}
            <code className="text-[11px]">src/components/pre-sales/pre-sales-form.tsx</code>{" "}
            e a obrigatoriedade é a real de{" "}
            <code className="text-[11px]">src/lib/pre-sales/schema.ts</code> — não a versão
            simplificada do mockup.
          </p>

          {secoesPreVendaDemo.map((secao) => (
            <fieldset key={secao.titulo} className="mb-5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]">
                {secao.titulo}
              </legend>
              <div className="space-y-2">
                {secao.campos.map((campo) => (
                  <label key={campo.campo} className="block">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--ns-text)]">
                      {campo.rotulo}
                      {campo.obrigatorio && <span className="text-[var(--ns-danger)]">*</span>}
                      {campo.sugeridoPelaIa && (
                        <span
                          title="Sugerido pela IA a partir da conversa — revise antes de salvar"
                          className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300"
                        >
                          <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                          IA
                        </span>
                      )}
                    </span>
                    <input
                      type="text"
                      readOnly
                      defaultValue={campo.valor ?? ""}
                      placeholder={campo.valor ? undefined : "Não preenchido"}
                      className="w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1.5 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {estado === "erro" && (
            <div
              role="alert"
              className="mb-2 rounded-lg border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-3 py-2 text-xs text-[var(--ns-danger)]"
            >
              Não foi possível salvar: esta é a Fase 1 (demonstração visual),
              a gravação real na pré-venda entra na Fase 3, ligada às regras
              do CRM. Nada foi perdido — o rascunho continua preenchido.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--ns-border)] px-4 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-[var(--ns-border)] px-3 py-2 text-sm font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarDemo}
            disabled={estado === "salvando"}
            className="rounded-lg bg-[var(--ns-primary)] px-3 py-2 text-sm font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90 disabled:opacity-60"
          >
            {estado === "salvando" ? "Salvando..." : "Salvar pré-venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
