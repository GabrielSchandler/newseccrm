import { notFound } from "next/navigation";
import { updateFinancingCalculationAction } from "@/app/(authenticated)/calculos/actions";
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
  const [clients, preSales] = await Promise.all([
    listCalculationClients(),
    listCalculationPreSales(),
  ]);

  return (
    <>
      <PageHeader
        title="Editar calculo"
        description="Atualize os dados do financiamento e recalcule os resultados preservando o historico do atendimento."
      />
      <div className="p-6">
        <CalculationForm
          mode="edit"
          submitLabel="Salvar recalculo"
          clients={clients}
          preSales={preSales}
          defaultValues={financingCalculationToFormValues(calculation)}
          onSubmitAction={(values) => updateFinancingCalculationAction(id, values)}
        />
      </div>
    </>
  );
}
