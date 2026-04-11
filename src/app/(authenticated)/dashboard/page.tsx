import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Area protegida para testar autenticacao e preparar os proximos modulos do CRM."
      />
      <div className="p-6">
        <PlaceholderPanel
          title="Autenticacao ativa"
          description="Esta pagina confirma que o usuario esta autenticado. Os indicadores reais serao conectados em uma etapa futura."
        />
      </div>
    </>
  );
}
