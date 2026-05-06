import { PageHeader } from "@/components/layout/page-header";

export default function JuridicoPage() {
  return (
    <>
      <PageHeader
        title="Juridico"
        description="Area separada para o modulo juridico do CRM."
      />
      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">
            Estrutura preparada
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A separacao entre Gestao, Comercial e Juridico ja ficou pronta. Nesta
            area vamos encaixar as telas juridicas no proximo passo, sem misturar
            com o fluxo comercial que ja esta em producao.
          </p>
        </section>
      </div>
    </>
  );
}
