import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";

export default function PreVendasPage() {
  return (
    <>
      <PageHeader
        title="Pre-vendas"
        description="Espaco reservado para oportunidades, contatos iniciais e fluxo comercial."
      />
      <div className="p-6">
        <PlaceholderPanel
          title="Modulo de pre-vendas"
          description="Esta tela ainda nao implementa regras de negocio; ela apenas valida navegacao e protecao de rotas."
        />
      </div>
    </>
  );
}
