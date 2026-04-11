import { PageHeader } from "@/components/layout/page-header";
import { PlaceholderPanel } from "@/components/layout/placeholder-panel";

export default function UsuariosPage() {
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Espaco reservado para gestao de usuarios e acessos."
      />
      <div className="p-6">
        <PlaceholderPanel
          title="Modulo de usuarios"
          description="A estrutura visual e de rota esta preparada, sem regras multiempresa ou permissoes avancadas por enquanto."
        />
      </div>
    </>
  );
}
