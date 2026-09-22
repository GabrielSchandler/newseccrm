import { TopBar } from "@/components/newsec/top-bar";
import { AtendimentoWorkspace } from "@/components/newsec/atendimento-workspace";

export default function AtendimentoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName="Empresa de demonstração" />
      <div className="min-h-0 flex-1">
        <AtendimentoWorkspace />
      </div>
    </div>
  );
}
