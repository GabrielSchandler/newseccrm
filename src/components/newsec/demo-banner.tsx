"use client";

import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";

/**
 * Escondido nas rotas que já consultam dado real do banco: /atendimento
 * (Entrega C) e /clientes (migração da área Clientes pro shell novo — só
 * troca o visual, os dados já eram reais desde sempre nessa área). As
 * demais rotas do shell novo (supervisão, dashboards, produtividade)
 * continuam 100% demonstração até as próximas entregas, então continuam
 * mostrando o aviso.
 */
export function DemoBanner() {
  const pathname = usePathname();
  if (pathname === "/atendimento" || pathname.startsWith("/clientes")) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--ns-border)] bg-[var(--ns-warning)]/10 px-4 py-1.5 text-xs font-medium text-[var(--ns-warning)]">
      <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      Modo de demonstração — conversas, contatos e valores abaixo são dados
      fictícios. Nenhuma mensagem é enviada de verdade.
    </div>
  );
}
