"use client";

import { useState } from "react";
import { Clock, MessagesSquare, Sparkles, UserX } from "lucide-react";
import {
  atencaoNecessariaDemo,
  cargaEquipeDemo,
  filaOperacionalDemo,
  indicadoresSupervisaoDemo,
  type ItemFila,
} from "@/lib/demo/supervisao-data";
import { StatCard } from "./stat-card";

export function SupervisaoWorkspace() {
  const [itemTransferencia, setItemTransferencia] = useState<ItemFila | null>(null);
  const [destino, setDestino] = useState("");

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Clock} label="Aguardando humano" value={String(indicadoresSupervisaoDemo.aguardandoHumano)} hint="+4 vs. ontem" accent="warning" />
        <StatCard icon={UserX} label="Sem responsável" value={String(indicadoresSupervisaoDemo.semResponsavel)} hint="+2 vs. ontem" accent="danger" />
        <StatCard icon={MessagesSquare} label="Em atendimento" value={String(indicadoresSupervisaoDemo.emAtendimento)} hint="-6 vs. ontem" accent="success" />
        <StatCard icon={Sparkles} label="IA ativa" value={String(indicadoresSupervisaoDemo.iaAtiva)} hint="+2 vs. ontem" accent="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)]">
          <div className="border-b border-[var(--ns-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--ns-text)]">Fila de atendimento</h2>
            <p className="text-xs text-[var(--ns-text-secondary)]">
              Clientes aguardando ou em atendimento. Priorize os casos mais críticos.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ns-border)] text-xs text-[var(--ns-text-secondary)]">
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Canal</th>
                  <th className="px-4 py-2 font-medium">Setor</th>
                  <th className="px-4 py-2 font-medium">Responsável</th>
                  <th className="px-4 py-2 font-medium">Espera</th>
                  <th className="px-4 py-2 font-medium">Situação</th>
                  <th className="px-4 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filaOperacionalDemo.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--ns-border)] last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[var(--ns-text)]">{item.cliente}</p>
                      <p className="max-w-[220px] truncate text-xs text-[var(--ns-text-secondary)]">{item.trecho}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{item.canal}</td>
                    <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{item.setor}</td>
                    <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">{item.responsavel ?? "—"}</td>
                    <td className={`px-4 py-2.5 ${item.esperaMinutos > 20 ? "font-medium text-[var(--ns-danger)]" : "text-[var(--ns-text-secondary)]"}`}>
                      {item.esperaMinutos} min
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.estado === "Aguardando"
                            ? "bg-[var(--ns-warning)]/15 text-[var(--ns-warning)]"
                            : "bg-[var(--ns-success)]/15 text-[var(--ns-success)]"
                        }`}
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setItemTransferencia(item);
                          setDestino("");
                        }}
                        className="rounded-lg border border-[var(--ns-border)] px-2.5 py-1 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                      >
                        Transferir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
            <h2 className="mb-1 text-sm font-semibold text-[var(--ns-text)]">Carga da equipe</h2>
            <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">
              Disponibilidade e capacidade configurável — não é só quantidade bruta.
            </p>
            <ul className="space-y-3">
              {cargaEquipeDemo.map((consultor) => (
                <li key={consultor.id} className="text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-[10px] font-semibold text-[var(--ns-primary)]">
                      {consultor.iniciais}
                    </div>
                    <span className="font-medium text-[var(--ns-text)]">{consultor.nome}</span>
                    <span className="text-xs text-[var(--ns-text-secondary)]">
                      {consultor.emAtendimento} em atendimento
                    </span>
                    <span
                      className={`ml-auto inline-flex items-center gap-1 text-[11px] ${
                        consultor.disponivel ? "text-[var(--ns-success)]" : "text-[var(--ns-danger)]"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {consultor.disponivel ? "Disponível" : "Ocupada"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ns-surface-hover)]">
                    <div
                      className={`h-full rounded-full ${
                        consultor.capacidadePercent >= 90 ? "bg-[var(--ns-danger)]" : "bg-[var(--ns-primary)]"
                      }`}
                      style={{ width: `${consultor.capacidadePercent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--ns-text)]">Atenção necessária</h2>
            <ul className="space-y-3">
              {atencaoNecessariaDemo.map((item) => (
                <li key={item.id} className="rounded-lg border border-[var(--ns-warning)]/30 bg-[var(--ns-warning)]/10 p-2.5">
                  <p className="text-xs font-semibold text-[var(--ns-text)]">{item.titulo}</p>
                  <p className="text-xs text-[var(--ns-text-secondary)]">{item.descricao}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {itemTransferencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-[var(--ns-text)]">Transferir atendimento</h2>
            <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">
              {itemTransferencia.cliente} · selecione o consultor para receber esta conversa
            </p>
            <select
              value={destino}
              onChange={(event) => setDestino(event.target.value)}
              className="mb-3 w-full rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2 text-sm text-[var(--ns-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
            >
              <option value="">Selecione um consultor disponível...</option>
              {cargaEquipeDemo
                .filter((c) => c.disponivel)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.emAtendimento} em atendimento · capacidade {c.capacidadePercent}%
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemTransferencia(null)}
                className="rounded-lg border border-[var(--ns-border)] px-3 py-2 text-sm font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!destino}
                onClick={() => setItemTransferencia(null)}
                title="Demonstração — nenhuma transferência real acontece"
                className="rounded-lg bg-[var(--ns-primary)] px-3 py-2 text-sm font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                Confirmar transferência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
