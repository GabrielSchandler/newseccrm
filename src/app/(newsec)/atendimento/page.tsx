import type { Metadata } from "next";
import { TopBar } from "@/components/newsec/top-bar";
import { AtendimentoWorkspace } from "@/components/newsec/atendimento-workspace";

export const metadata: Metadata = {
  title: "Atendimento · NewSec (demonstração)",
};

export default function AtendimentoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName="Empresa de demonstração" links={[{ href: "/atendimento/supervisao", label: "Supervisão" }]} />
      <div className="min-h-0 flex-1">
        <AtendimentoWorkspace />
      </div>
    </div>
  );
}
