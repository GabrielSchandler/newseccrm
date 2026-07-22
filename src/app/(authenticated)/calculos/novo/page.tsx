import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CalculationForm } from "@/components/calculations/calculation-form";
import { createFinancingCalculationAction } from "@/app/(authenticated)/calculos/actions";
import { formatCpf, formatPhone } from "@/lib/clients/masks";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  canManageCalculations,
  listCalculationClients,
  listCalculationPreSales,
} from "@/lib/calculations/service";
import { formatNumberForPtBrInput } from "@/lib/calculations/currency";
import { getHomeForRole } from "@/lib/workspace";
import {
  financingCalculationDefaultValues,
  type FinancingCalculationFormValues,
} from "@/lib/calculations/schema";

type NovoCalculoPageProps = {
  searchParams: Promise<{ preSaleId?: string; clientId?: string }>;
};

export default async function NovoCalculoPage({
  searchParams,
}: NovoCalculoPageProps) {
  const { role, businessArea } = await getCurrentUserContext();
  const params = await searchParams;

  if (!canManageCalculations(role)) {
    redirect(getHomeForRole(role, businessArea));
  }

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
        : "Não foi possível carregar clientes e pré-vendas para preenchimento automático.";
  }

  let defaultValues: FinancingCalculationFormValues = financingCalculationDefaultValues;
  const selectedPreSale = params.preSaleId
    ? preSales.find((item) => item.id === params.preSaleId)
    : null;
  const selectedClient = params.clientId
    ? clients.find((item) => item.id === params.clientId)
    : null;

  if (selectedPreSale) {
    defaultValues = {
      ...defaultValues,
      client_id: selectedPreSale.client_id,
      pre_sale_id: selectedPreSale.id,
      simulation_type: selectedPreSale.pre_sale_type,
      client_name: selectedPreSale.client_name,
      client_cpf: formatCpf(selectedPreSale.client_cpf),
      client_phone: formatPhone(selectedPreSale.client_phone ?? ""),
      financial_institution: selectedPreSale.financial_institution ?? "",
      specialist_name: selectedPreSale.specialist_name ?? "",
      vehicle: selectedPreSale.vehicle ?? "",
      vehicle_year: selectedPreSale.vehicle_year ?? "",
      financed_value: formatNumberForPtBrInput(selectedPreSale.financed_value),
      down_payment: formatNumberForPtBrInput(selectedPreSale.down_payment),
      current_installment_value: formatNumberForPtBrInput(
        selectedPreSale.current_installment_value,
      ),
      paid_installments:
        selectedPreSale.paid_installments === null
          ? ""
          : String(selectedPreSale.paid_installments),
      remaining_installments:
        selectedPreSale.remaining_installments === null
          ? ""
          : String(selectedPreSale.remaining_installments),
    };
  } else if (selectedClient) {
    defaultValues = {
      ...defaultValues,
      client_id: selectedClient.id,
      client_name: selectedClient.full_name,
      client_cpf: formatCpf(selectedClient.cpf),
      client_phone: formatPhone(selectedClient.phone_mobile),
    };
  }

  return (
    <>
      <PageHeader
        title="Nova simulação"
        description="Preencha os dados operacionais, revise os números e gere a simulação de análise de correção de juros para o cliente."
      />
      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Não foi possível carregar as listas auxiliares de clientes e pré-vendas.
            Você ainda pode preencher a simulação manualmente. Detalhe: {loadError}
          </div>
        ) : null}
        <CalculationForm
          mode="create"
          submitLabel="Calcular e salvar simulação"
          clients={clients}
          preSales={preSales}
          defaultValues={defaultValues}
          onSubmitAction={createFinancingCalculationAction}
        />
      </div>
    </>
  );
}
