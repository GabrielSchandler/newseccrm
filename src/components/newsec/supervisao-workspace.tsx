"use client";

import { useState } from "react";
import { ChevronRight, Clock, Headphones, Sparkles, UserX, Users2 } from "lucide-react";
import {
  abasSupervisaoDemo,
  atencaoNecessariaDemo,
  cargaEquipeDemo,
  filaOperacionalDemo,
  indicadoresSupervisaoDemo,
  tempoMedioHojeDemo,
  tempoRespostaSeriesDemo,
  type ItemFila,
} from "@/lib/demo/supervisao-data";
import { FiltroPill } from "./filtro-pill";
import { StatCard } from "./stat-card";

const ICONE_ATENCAO = { clock: Clock, semResponsavel: UserX } as const;

function GraficoTempoResposta() {
  const valores = tempoRespostaSeriesDemo.map((p) => p.minutos);
  const maior = Math.max(...valores);
  const escalaY = [0, 0.33, 0.66, 1].map((fator) => Math.round((maior * fator) / 5) * 5).reverse();
  const largura = 640;
  const altura = 110;
  const passoX = largura / Math.max(valores.length - 1, 1);
  const pontos = valores.map((valor, index) => ({
    x: index * passoX,
    y: altura - (valor / (maior || 1)) * (altura - 10) - 5,
  }));
  const linha = pontos.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${altura} ${linha} ${largura},${altura}`;

  return (
    <div className="flex gap-2">
      <div className="flex h-[110px] flex-col justify-between text-right text-[10px] text-[var(--ns-text-secondary)]">
        {escalaY.map((valor) => (
          <span key={valor}>{valor} min</span>
        ))}
      </div>
      <div className="flex-1 border-l border-[var(--ns-border)] pl-3">
        <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" style={{ height: altura }} preserveAspectRatio="none">
          <polygon points={area} fill="var(--ns-primary)" opacity="0.12" />
          <polyline points={linha} fill="none" stroke="var(--ns-primary)" strokeWidth="2" />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--ns-text-secondary)]">
          {tempoRespostaSeriesDemo.map((p) => (
            <span key={p.hora}>{p.hora}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupervisaoWorkspace() {
  const [itemTransferencia, setItemTransferencia] = useState<ItemFila | null>(null);
  const [destino, setDestino] = useState("");
  const [mensagem, setMensagem] = useState("");

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[var(--ns-text)]">Supervisão de atendimento</h1>
        <p className="text-xs text-[var(--ns-text-secondary)]">
          Acompanhe a operação em tempo real e garanta a melhor experiência para seus clientes.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 border-b border-[var(--ns-border)]">
        {abasSupervisaoDemo.map((aba, index) => (
          <button
            key={aba}
            type="button"
            title="Aba (demonstração)"
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition ${
              index === 0
                ? "border-[var(--ns-primary)] text-[var(--ns-primary)]"
                : "border-transparent text-[var(--ns-text-secondary)] hover:text-[var(--ns-text)]"
            }`}
          >
            {aba}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltroPill label="Hoje" />
        <FiltroPill label="Todas as equipes" />
        <FiltroPill label="Todos os canais" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Clock} label="Aguardando humano" value={String(indicadoresSupervisaoDemo.aguardandoHumano)} hint="+4 vs. ontem" accent="warning" />
        <StatCard icon={UserX} label="Sem responsável" value={String(indicadoresSupervisaoDemo.semResponsavel)} hint="+2 vs. ontem" accent="danger" />
        <StatCard icon={Headphones} label="Em atendimento" value={String(indicadoresSupervisaoDemo.emAtendimento)} hint="-6 vs. ontem" accent="success" />
        <StatCard icon={Sparkles} label="IA ativa" value={String(indicadoresSupervisaoDemo.iaAtiva)} hint="+2 vs. ontem" accent="primary" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
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
                  <th className="px-4 py-2 font-medium">Tipo</th>
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
                    <td className="px-4 py-2.5 text-[var(--ns-text-secondary)]">
                      {item.responsavel ?? (item.tipo === "IA" ? "IA" : "—")}
                    </td>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.tipo === "IA"
                            ? "bg-[#8b5cf6]/15 text-[#8b5cf6]"
                            : "bg-[var(--ns-primary)]/15 text-[var(--ns-primary)]"
                        }`}
                      >
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setItemTransferencia(item);
                          setDestino("");
                          setMensagem("");
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
          <p className="border-t border-[var(--ns-border)] px-4 py-2.5 text-xs text-[var(--ns-text-secondary)]">
            Mostrando {filaOperacionalDemo.length} de {filaOperacionalDemo.length} atendimentos
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
            <h2 className="mb-1 text-sm font-semibold text-[var(--ns-text)]">Carga da equipe</h2>
            <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">
              Veja a disponibilidade e a carga de cada consultor.
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--ns-text-secondary)]">
                  <th className="pb-2 font-medium">Consultor</th>
                  <th className="pb-2 font-medium">Ativos</th>
                  <th className="pb-2 font-medium">Capacidade</th>
                </tr>
              </thead>
              <tbody>
                {cargaEquipeDemo.map((consultor) => (
                  <tr key={consultor.id} className="border-t border-[var(--ns-border)]">
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-[10px] font-semibold text-[var(--ns-primary)]">
                          {consultor.iniciais}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--ns-text)]">{consultor.nome}</p>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] ${
                              consultor.disponivel ? "text-[var(--ns-success)]" : "text-[var(--ns-danger)]"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {consultor.disponivel ? "Disponível" : "Ocupada"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-[var(--ns-text-secondary)]">
                      {consultor.emAtendimento}
                      <span className="block text-[10px]">mais antigo {consultor.maisAntigoMinutos} min</span>
                    </td>
                    <td className="py-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--ns-surface-hover)]">
                        <div
                          className={`h-full rounded-full ${
                            consultor.capacidadePercent >= 90 ? "bg-[var(--ns-danger)]" : "bg-[var(--ns-primary)]"
                          }`}
                          style={{ width: `${consultor.capacidadePercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--ns-text-secondary)]">{consultor.capacidadePercent}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              title="Demonstração"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ns-primary)] px-3 py-2 text-xs font-medium text-[var(--ns-primary-foreground)] transition hover:opacity-90"
            >
              <Users2 aria-hidden="true" className="h-3.5 w-3.5" />
              Distribuir atendimentos
            </button>
          </div>

          <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ns-text)]">Atenção necessária</h2>
              <button
                type="button"
                title="Ver todos (demonstração)"
                className="text-xs font-medium text-[var(--ns-primary)] hover:underline"
              >
                Ver todos ({atencaoNecessariaDemo.length})
              </button>
            </div>
            <ul className="space-y-2">
              {atencaoNecessariaDemo.map((item) => {
                const Icon = ICONE_ATENCAO[item.icone];
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-[var(--ns-danger)]/30 bg-[var(--ns-danger)]/10 p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ns-danger)]" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--ns-text)]">{item.titulo}</p>
                        <p className="text-xs text-[var(--ns-text-secondary)]">{item.descricao}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        title="Demonstração"
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
                      >
                        {item.acaoLabel}
                        <ChevronRight aria-hidden="true" className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ns-text)]">Tempo de primeira resposta</h2>
          <p className="mb-3 text-xs text-[var(--ns-text-secondary)]">Tempo médio até o primeiro contato com o cliente.</p>
          <GraficoTempoResposta />
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-[var(--ns-border)] bg-[var(--ns-success)]/10 p-4">
          <p className="text-xs text-[var(--ns-text-secondary)]">Tempo médio hoje</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ns-text)]">{tempoMedioHojeDemo.minutos} min</p>
          <p className="mt-1 text-xs font-medium text-[var(--ns-success)]">
            ↓ {Math.abs(tempoMedioHojeDemo.variacaoPercent)}% vs. ontem
          </p>
        </div>
      </div>

      {itemTransferencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-4 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ns-text)]">Transferir atendimento</h2>
              <button
                type="button"
                onClick={() => setItemTransferencia(null)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-[var(--ns-text-secondary)] hover:bg-[var(--ns-surface-hover)]"
              >
                ×
              </button>
            </div>
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
                    {c.nome} · {c.emAtendimento} em atendimento · Disponível · Capacidade {c.capacidadePercent}%
                  </option>
                ))}
            </select>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-[var(--ns-text-secondary)]">Mensagem (opcional)</span>
              <textarea
                value={mensagem}
                onChange={(event) => setMensagem(event.target.value.slice(0, 200))}
                rows={3}
                placeholder="Dê contexto pro colega que vai assumir a conversa."
                className="w-full resize-none rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-2.5 py-2 text-sm text-[var(--ns-text)] outline-none placeholder:text-[var(--ns-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--ns-primary)]"
              />
              <span className="mt-1 block text-right text-[10px] text-[var(--ns-text-secondary)]">{mensagem.length}/200</span>
            </label>
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
