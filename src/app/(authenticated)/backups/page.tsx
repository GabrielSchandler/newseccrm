import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getHomeForRole } from "@/lib/workspace";
import { BackupGenerator } from "./backup-generator";

const backupItems = [
  "Dados da empresa, usuarios, clientes, pre-vendas e pagamentos.",
  "Templates, documentos gerados, simulacoes e arquivos anexados aos clientes.",
  "Linha do tempo, acompanhamento do cliente, logs, emails e registros de importacao.",
];

export default async function BackupsPage() {
  const { role, businessArea } = await getCurrentUserContext();

  if (role !== "admin") {
    redirect(getHomeForRole(role, businessArea));
  }

  return (
    <>
      <PageHeader
        title="Backups"
        description="Gere um arquivo ZIP com uma copia dos dados e documentos essenciais do CRM."
      />

      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Backup manual
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Baixe uma copia completa para guardar fora da plataforma
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                O arquivo e montado no momento do clique e pode ser salvo no
                OneDrive, Google Drive ou em outro local seguro da empresa. O
                nome do ZIP usa a data e hora da geracao para facilitar a
                organizacao dos historicos.
              </p>

              <BackupGenerator />
            </div>

            <div className="rounded-lg border border-teal-100 bg-teal-50 p-5">
              <h3 className="text-sm font-semibold text-teal-950">
                O que entra no backup
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-950">
                {backupItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Dados sensiveis
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O ZIP pode conter documentos, dados pessoais, emails e tokens
              criptografados. Guarde somente em uma pasta autorizada.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Arquivo grande
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Se houver muitos documentos, o download pode demorar. Aguarde a
              resposta do navegador antes de fechar a aba.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Conferencia
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dentro do ZIP existe um arquivo manifest.json com a quantidade de
              linhas exportadas e possiveis avisos sobre arquivos nao baixados.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
