"use client";

import { RefreshCw, Sparkles, UserPlus, FileSpreadsheet, ClipboardList } from "lucide-react";
import type { ConversaDemo } from "@/lib/demo/atendimento-data";

export function ContextPanel({
  conversa,
  onAbrirPreVenda,
}: {
  conversa: ConversaDemo;
  onAbrirPreVenda: () => void;
}) {
  const podecriarPreVenda = conversa.clienteCadastrado;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-[var(--ns-border)] p-4">
      <div className="mb-4 flex items-center gap-3">
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
        </div>
      </div>

      <button
        type="button"
        title="Atualizar contexto (demonstração)"
        className="mb-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ns-border)] px-3 py-2 text-xs font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
      >
        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        Atualizar contexto
      </button>

      <Secao titulo="Resumo">
        <p className="text-xs text-[var(--ns-text-secondary)]">{conversa.contexto.resumo}</p>
        <p className="mt-1 text-[10px] text-[var(--ns-text-secondary)]">
          Atualizado {conversa.contexto.atualizadoEm}
        </p>
      </Secao>

      <Secao titulo="Telefones">
        <ul className="space-y-1">
          {conversa.telefones.map((telefone) => (
            <li key={telefone} className="text-xs text-[var(--ns-text)]">
              {telefone}
            </li>
          ))}
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
              <li key={venda.servico} className="rounded-lg border border-[var(--ns-border)] p-2 text-xs">
                <p className="font-medium text-[var(--ns-text)]">{venda.servico}</p>
                <p className="text-[var(--ns-text-secondary)]">
                  {venda.valor} · {venda.status}
                </p>
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

      <div className="mt-2 space-y-2 border-t border-[var(--ns-border)] pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]">
          Ações rápidas
        </p>
        <AcaoBotao icon={Sparkles} label="Gerar análise" ajuda="Funciona sem cliente cadastrado" />
        <AcaoBotao icon={UserPlus} label="Cadastrar cliente" ajuda="Abre os campos obrigatórios reais do CRM" />
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
        <AcaoBotao icon={FileSpreadsheet} label="Registrar ligação" ajuda="Autoria, momento e observações — sem WhatsApp" />
      </div>
    </aside>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <button
        type="button"
        className="mb-1 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--ns-text-secondary)]"
      >
        {titulo}
      </button>
      {children}
    </div>
  );
}

function AcaoBotao({
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
      className="flex w-full items-center gap-2 rounded-lg border border-[var(--ns-border)] px-3 py-2 text-left text-sm font-medium text-[var(--ns-text)] transition hover:bg-[var(--ns-surface-hover)]"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
