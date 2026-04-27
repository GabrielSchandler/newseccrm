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
import {
  financingCalculationDefaultValues,
  type FinancingCalculationFormValues,
} from "@/lib/calculations/schema";

type NovoCalculoPageProps = {
  searchParams: Promise<{ preSaleId?: string; clientId?: string }>;
};

function numberToInput(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(".", ",");
}

export default async function NovoCalculoPage({
  searchParams,
}: NovoCalculoPageProps) {
  const { role } = await getCurrentUserContext();
  const params = await searchParams;

  if (!canManageCalculations(role)) {
    redirect(role === "seller" ? "/pre-vendas" : "/dashboard");
  }

  const [clients, preSales] = await Promise.all([
    listCalculationClients(),
    listCalculationPreSales(),
  ]);

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
      client_name: selectedPreSale.client_name,
      client_cpf: formatCpf(selectedPreSale.client_cpf),
      client_phone: formatPhone(selectedPreSale.client_phone ?? ""),
      financer_name: selectedPreSale.financer_name ?? "",
      specialist_name: selectedPreSale.specialist_name ?? "",
      vehicle: selectedPreSale.vehicle ?? "",
      vehicle_year: selectedPreSale.vehicle_year ?? "",
      financed_value: numberToInput(selectedPreSale.financed_value),
      down_payment: numberToInput(selectedPreSale.down_payment),
      current_installment_value: numberToInput(
        selectedPreSale.current_installment_value,
      ),
      installment_count:
        selectedPreSale.installment_count === null
          ? ""
          : String(selectedPreSale.installment_count),
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
        title="Novo calculo"
        description="Preencha os dados operacionais, revise os numeros e gere uma analise sintetizada para o cliente."
      />
      <div className="p-6">
        <CalculationForm
          mode="create"
          submitLabel="Calcular e salvar"
          clients={clients}
          preSales={preSales}
          defaultValues={defaultValues}
          onSubmitAction={createFinancingCalculationAction}
        />
      </div>
    </>
  );
}
