import { notFound } from "next/navigation";
import { updateFinancingCalculationAction } from "@/app/(authenticated)/calculos/actions";
import { CalculationDeleteButton } from "@/components/calculations/calculation-delete-button";
import { CalculationForm } from "@/components/calculations/calculation-form";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { financingCalculationToFormValues } from "@/lib/calculations/schema";
import {
  assertCalculationAccess,
  canManageCalculations,
  listCalculationClients,
  listCalculationPreSales,
} from "@/lib/calculations/service";

type EditarCalculoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarCalculoPage({
  params,
}: EditarCalculoPageProps) {
  const { role } = await getCurrentUserContext();
  const { id } = await params;

  if (!canManageCalculations(role)) {
    notFound();
  }

  const calculation = await assertCalculationAccess(id);
  const updateCalculationAction = updateFinancingCalculationAction.bind(null, id);
  let loadError: string | null = null;
  let clients = [] as Awaited<ReturnType<typeof listCalculationClients>>;
  let preSales = [] as Awaited<ReturnType<typeof listCalculationPreSales>>;

  try {
    [clients, preSales] = await Promise.all([
      listCalculationClients(),
      listCalculationPreSales(),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar clientes e pré-vendas para edição assistida.";
  }

  return (
    <>
      <PageHeader
        title="Editar simulação"
        description="Atualize os dados do financiamento e recalcule os resultados preservando o histórico do atendimento."
      />
      <div className="space-y-6 p-6">
        <CalculationDeleteButton calculationId={id} />
        {loadError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Não foi possível carregar as listas auxiliares de clientes e pré-vendas.
            Você ainda pode editar a simulação manualmente. Detalhe: {loadError}
          </div>
        ) : null}
        <CalculationForm
          mode="edit"
          submitLabel="Salvar simulação"
          clients={clients}
          preSales={preSales}
          defaultValues={financingCalculationToFormValues(calculation)}
          onSubmitAction={updateCalculationAction}
        />
      </div>
    </>
  );
}
