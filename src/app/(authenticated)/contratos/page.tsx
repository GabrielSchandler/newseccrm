import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";

export default function ContratosPage() {
  return (
    <>
      <PageHeader
        title="Contratos"
        description="Espaco reservado para acompanhamento de contratos."
      />
      <div className="p-6">
        <PlaceholderPanel
          title="Modulo de contratos"
          description="A tela esta pronta para receber consultas e formularios quando as regras forem definidas."
        />
      </div>
    </>
  );
}
