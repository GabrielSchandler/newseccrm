import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--ns-border)] bg-[var(--ns-warning)]/10 px-4 py-1.5 text-xs font-medium text-[var(--ns-warning)]">
      <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      Modo de demonstração — conversas, contatos e valores abaixo são dados
      fictícios. Nenhuma mensagem é enviada de verdade.
    </div>
  );
}
