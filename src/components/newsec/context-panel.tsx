"use client";

import { useState } from "react";
import { Mail, MapPin, MoreVertical, Pencil, RefreshCw, Sparkles, UserPlus, Phone, ClipboardList } from "lucide-react";
import type { ConversaDemo } from "@/lib/demo/atendimento-data";

type Aba = "resumo" | "historico" | "arquivos" | "tarefas";
const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "historico", label: "Histórico" },
  { id: "arquivos", label: "Arquivos" },
  { id: "tarefas", label: "Tarefas" },
];

export function ContextPanel({
  conversa,
  onAbrirPreVenda,
}: {
  conversa: ConversaDemo;
  onAbrirPreVenda: () => void;
}) {
  const [aba, setAba] = useState<Aba>("resumo");
  const podecriarPreVenda = conversa.clienteCadastrado;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-[var(--ns-border)]">
      <div className="p-4 pb-0">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ns-primary)]/15 text-sm font-semibold text-[var(--ns-primary)]">
              {conversa.nome
                .split(" ")
                .slice(0, 2)
                .map((parte) => parte[0])
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ns-text)]">{conversa.nome}</p>
              <p
                className={`text-xs ${
                  conversa.clienteCadastrado ? "text-[var(--ns-success)]" : "text-[var(--ns-warning)]"
                }`}
              >
                {conversa.clienteCadastrado ? "Cliente cadastrado" : "Contato · cadastro pendente"}
              </p>
              {conversa.clienteDesde && (
                <p className="text-[11px] text-[var(--ns-text-secondary)]">Cliente desde {conversa.clienteDesde}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            title="Mais opções (demonstração)"
            aria-label="Mais opções"
            className="shrink-0 rounded-lg p-1 text-[var(--ns-text-secondary)] hover:bg-[var(--ns-surface-hover)]"
          >
            <MoreVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-4 border-b border-[var(--ns-border)]">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
              className={`-mb-px border-b-2 px-0.5 pb-2 text-xs font-medium transition ${
                aba === item.id
                  ? "border-[var(--ns-primary)] text-[var(--ns-primary)]"
                  : "border-transparent text-[var(--ns-text-secondary)] hover:text-[var(--ns-text)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {aba !== "resumo" ? (
          <p className="text-xs text-[var(--ns-text-secondary)]">
            Em breve — {ABAS.find((a) => a.id === aba)?.label.toLowerCase()} ainda não está disponível nesta demonstração.
          </p>
        ) : (
          <>
            <Secao titulo="Resumo">
              <p className="text-xs text-[var(--ns-text-secondary)]">{conversa.contexto.resumo}</p>
              <p className="mt-1 text-[10px] text-[var(--ns-text-secondary)]">
                Atualizado {conversa.contexto.atualizadoEm}
              </p>
            </Secao>

            <Secao titulo="Contato">
              <ul className="space-y-2">
                {conversa.telefones.map((telefone, index) => (
                  <li key={telefone} className="flex items-start gap-2 text-xs">
                    <Phone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ns-text-secondary)]" />
                    <span>
                      <span className="block text-[10px] text-[var(--ns-text-secondary)]">
                        {index === 0 ? "Principal" : "Outro"} · final {telefone.slice(-4)}
                      </span>
                      <span className="text-[var(--ns-text)]">{telefone}</span>
                    </span>
                  </li>
                ))}
                {conversa.email && (
                  <li className="flex items-center gap-2 text-xs">
                    <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--ns-text-secondary)]" />
                    <span className="text-[var(--ns-text)]">{conversa.email}</span>
                  </li>
                )}
                {conversa.localizacao && (
                  <li className="flex items-center gap-2 text-xs">
                    <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--ns-text-secondary)]" />
                    <span className="text-[var(--ns-text)]">{conversa.localizacao}</span>
                  </li>
                )}
              </ul>
            </Secao>

            <Secao titulo="Pré-venda">
              <p className="text-xs text-[var(--ns-text-secondary)]">
                {conversa.contexto.preVenda ?? "Nenhuma pré-venda vinculada ainda."}
              </p>
            </Secao>

            <Secao titulo="Pós-venda">
              <p className="text-xs text-[var(--ns-text-secondary)]">
                {conversa.contexto.posVenda ?? "Sem chamado de pós-venda aberto."}
              </p>
            </Secao>

            {conversa.contexto.vendas.length > 0 && (
              <Secao titulo="Vendas">
                <ul className="space-y-2">
                  {conversa.contexto.vendas.map((venda) => (
                    <li
                      key={venda.servico}
                      className="flex items-start justify-between gap-2 rounded-lg border border-[var(--ns-border)] p-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ns-warning)]" />
                        <div>
                          <p className="font-medium text-[var(--ns-text)]">{venda.servico}</p>
                          <p className="text-[var(--ns-text-secondary)]">
                            {venda.valor} · {venda.status}
                          </p>
                        </div>
                      </div>
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--ns-text-secondary)]" />
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            {conversa.contexto.faltantes.length > 0 && (
              <Secao titulo="Informações faltantes">
                <ul className="space-y-1">
                  {conversa.contexto.faltantes.map((faltante) => (
                    <li key={faltante} className="text-xs text-[var(--ns-warning)]">
                      • {faltante}
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            <button
              type="button"
              title="Atualizar contexto (demonstração)"
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ns-border)] px-3 py-2 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Atualizar contexto
            </button>

            <div className="space-y-2 border-t border-[var(--ns-border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]">
                Ações rápidas
              </p>
              <div className="grid grid-cols-3 gap-2">
                <AcaoBotaoCompacta icon={Sparkles} label="Gerar análise" ajuda="Funciona sem cliente cadastrado" />
                <AcaoBotaoCompacta icon={UserPlus} label="Cadastrar" ajuda="Abre os campos obrigatórios reais do CRM" />
                <AcaoBotaoCompacta icon={Phone} label="Ligação" ajuda="Autoria, momento e observações — sem WhatsApp" />
              </div>
              <button
                type="button"
                onClick={podecriarPreVenda ? onAbrirPreVenda : undefined}
                disabled={!podecriarPreVenda}
                title={
                  podecriarPreVenda
                    ? "Abrir drawer de pré-venda"
                    : "Requer cliente cadastrado — cadastre antes de criar a pré-venda"
                }
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--ns-border)] px-3 py-2 text-left text-sm font-medium text-[var(--ns-text)] transition enabled:hover:bg-[var(--ns-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardList aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="flex-1">Criar pré-venda</span>
                {!podecriarPreVenda && (
                  <span className="rounded-full bg-[var(--ns-warning)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--ns-warning)]">
                    requer cadastro
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]">{titulo}</p>
      {children}
    </div>
  );
}

function AcaoBotaoCompacta({
  icon: Icon,
  label,
  ajuda,
}: {
  icon: typeof Sparkles;
  label: string;
  ajuda: string;
}) {
  return (
    <button
      type="button"
      title={`${ajuda} (demonstração)`}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--ns-border)] px-2 py-2.5 text-center transition hover:bg-[var(--ns-surface-hover)]"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--ns-text-secondary)]" />
      <span className="text-[11px] font-medium leading-tight text-[var(--ns-text)]">{label}</span>
    </button>
  );
}
