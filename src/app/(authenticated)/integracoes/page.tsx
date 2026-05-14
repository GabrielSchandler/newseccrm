import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { OutlookDisconnectButton } from "@/components/email/outlook-disconnect-button";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { getMicrosoftIntegrationForUser } from "@/lib/email/integrations";

type IntegracoesPageProps = {
  searchParams: Promise<{ outlook?: string; error?: string }>;
};

function canConnectOutlook(role: string | null, businessArea: string, legalRole: string | null) {
  return role === "admin" || role === "manager" || (businessArea === "legal" && legalRole === "admin");
}

function getMessage(params: { outlook?: string; error?: string }) {
  if (params.outlook === "connected") {
    return {
      tone: "success" as const,
      text: "Outlook conectado com sucesso.",
    };
  }

  if (params.error === "permission") {
    return {
      tone: "error" as const,
      text: "Apenas adms juridicos, administradores ou gerentes podem conectar Outlook.",
    };
  }

  if (params.error === "outlook_config") {
    return {
      tone: "error" as const,
      text: "A integracao Outlook ainda nao esta configurada na Vercel. Revise MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET e MICROSOFT_REDIRECT_URI.",
    };
  }

  if (params.error === "invalid_state") {
    return {
      tone: "error" as const,
      text: "A conexao expirou. Clique em Conectar Outlook novamente.",
    };
  }

  if (params.error === "outlook_denied") {
    return {
      tone: "error" as const,
      text: "A Microsoft recusou a autorizacao. Confirme o consentimento da conta e tente novamente.",
    };
  }

  if (params.error === "connect_failed") {
    return {
      tone: "error" as const,
      text: "Nao foi possivel finalizar a conexao com a Microsoft. Confira o segredo do aplicativo, a URL de callback e as permissoes do Graph.",
    };
  }

  if (params.error) {
    return {
      tone: "error" as const,
      text: "Nao foi possivel conectar o Outlook. Revise as permissoes Microsoft e tente novamente.",
    };
  }

  return null;
}

export default async function IntegracoesPage({ searchParams }: IntegracoesPageProps) {
  const params = await searchParams;
  const { companyId, userProfileId, role, businessArea, legalRole } =
    await getCurrentUserContext();
  const integration = await getMicrosoftIntegrationForUser(companyId, userProfileId);
  const canConnect = canConnectOutlook(role, businessArea, legalRole);
  const message = getMessage(params);

  return (
    <>
      <PageHeader
        title="Integracoes"
        description="Conecte o Outlook usado pelo CRM para criar rascunhos e enviar emails juridicos."
      />
      <div className="space-y-6 p-6">
        {message ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === "success"
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Outlook do Adm juridico</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                O email enviado no cliente sai pela conta Outlook do Adm responsavel. Cada Adm juridico conecta a propria conta uma vez.
              </p>
            </div>
            {canConnect ? (
              <Link
                href="/integracoes/outlook/connect"
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                {integration ? "Reconectar Outlook" : "Conectar Outlook"}
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {integration ? "Conectado" : "Nao conectado"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email conectado
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {displayValue(integration?.email ?? null)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ultimo uso
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {formatDateTime(integration?.last_used_at ?? null)}
              </p>
            </div>
          </div>

          {!canConnect ? (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este usuario nao esta marcado como Adm juridico. A conexao oficial do Outlook deve ser feita pelo Adm responsavel.
            </p>
          ) : null}

          {integration ? (
            <div className="mt-6">
              <OutlookDisconnectButton />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
