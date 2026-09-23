import type { Metadata } from "next";
import { TopBar } from "@/components/newsec/top-bar";
import { AtendimentoWorkspaceReal } from "@/components/newsec/atendimento-workspace-real";
import { getCurrentUserContext } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Atendimento · NewSec",
};

export default async function AtendimentoPage() {
  const { userProfileId, companyId, role, isPlatformOwner, activeCompany } = await getCurrentUserContext();
  const companyName = activeCompany?.trade_name ?? activeCompany?.legal_name ?? "Empresa";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName={companyName} links={[{ href: "/atendimento/supervisao", label: "Supervisão" }]} />
      <div className="min-h-0 flex-1">
        <AtendimentoWorkspaceReal
          companyId={companyId}
          userProfileId={userProfileId}
          isAdminOuManager={role === "admin" || role === "manager"}
          isPlatformOwner={Boolean(isPlatformOwner)}
        />
      </div>
    </div>
  );
}
