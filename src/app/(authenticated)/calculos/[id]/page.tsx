import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CalculationDeleteButton } from "@/components/calculations/calculation-delete-button";
import { CalculationPdfActions } from "@/components/calculations/calculation-pdf-actions";
import { CalculationStatusBadge } from "@/components/calculations/calculation-status-badge";
import { ClientToast } from "@/components/clients/client-toast";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  formatCalculationCurrency,
  formatCalculationDate,
  formatCalculationDateTime,
  formatCpfDigits,
} from "@/lib/calculations/formatters";
import { assertCalculationAccess, canManageCalculations } from "@/lib/calculations/service";
import { resolveUserDisplayName } from "@/lib/users/account";

type CalculoPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}

export default async function CalculoPage({
  params,
  searchParams,
}: CalculoPageProps) {
  const { id } = await params;
  const queryParams = await searchParams;
  const { supabase, role } = await getCurrentUserContext();

  if (!canManageCalculations(role)) {
    notFound();
  }

  const calculation = await assertCalculationAccess(id);
  const { data: creatorData } = calculation.created_by
    ? await supabase
        .from("user_profiles")
        .select("full_name, username, email")
        .eq("id", calculation.created_by)
        .maybeSingle()
    : { data: null };
  const creatorName = resolveUserDisplayName(
    creatorData as { full_name?: string | null; username?: string | null; email?: string | null } | null,
    "Nao informado",
  );
  const successMessage =
    queryParams.success === "created"
      ? "Simulacao salva com sucesso."
      : queryParams.success === "updated"
        ? "Simulacao atualizada com sucesso."
        : null;

  return (
    <>
      <PageHeader
        title={calculation.client_name}
        description="Relatorio operacional da simulacao revisional pronto para consulta, ajuste e emissao do PDF."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/calculos/${calculation.id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          <Link
            href="/calculos"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para simulacoes
          </Link>
          <CalculationDeleteButton calculationId={calculation.id} />
          {calculation.client_id ? (
            <Link
              href={`/clientes/${calculation.client_id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir cliente
            </Link>
          ) : null}
          {calculation.pre_sale_id ? (
            <Link
              href={`/pre-vendas/${calculation.pre_sale_id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir pre-venda
            </Link>
          ) : null}
        </div>

        <DetailSection title="Resumo da simulacao">
          <DetailItem label="Status" value={<CalculationStatusBadge status={calculation.status} />} />
          <DetailItem label="Financeira" value={calculation.financial_institution ?? "Nao informado"} />
          <DetailItem label="Criado por" value={creatorName} />
          <DetailItem label="Criado em" value={formatCalculationDateTime(calculation.created_at)} />
          <DetailItem label="Data de atendimento" value={formatCalculationDate(calculation.attendance_date)} />
          <DetailItem label="Expira em" value={formatCalculationDate(calculation.expires_in)} />
        </DetailSection>

        <DetailSection title="Dados do cliente">
          <DetailItem label="Nome" value={calculation.client_name} />
          <DetailItem label="CPF" value={formatCpfDigits(calculation.client_cpf)} />
          <DetailItem label="Telefone" value={calculation.client_phone ?? "Nao informado"} />
          <DetailItem label="Especialista" value={calculation.specialist_name ?? "Nao informado"} />
          <DetailItem label="Situacao" value={calculation.situation ?? "Nao informado"} />
          <DetailItem label="Observacoes" value={calculation.notes ?? "Nao informado"} className="md:col-span-2" />
        </DetailSection>

        <DetailSection title="Dados do financiamento">
          <DetailItem label="Valor a vista" value={formatCalculationCurrency(calculation.cash_value)} />
          <DetailItem label="Entrada" value={formatCalculationCurrency(calculation.down_payment)} />
          <DetailItem label="Valor financiado" value={formatCalculationCurrency(calculation.financed_value)} />
          <DetailItem label="Valor atual da parcela" value={formatCalculationCurrency(calculation.current_installment_value)} />
          <DetailItem label="Quantidade de parcelas" value={String(calculation.installment_count ?? "Nao informado")} />
          <DetailItem label="Parcelas pagas" value={String(calculation.paid_installments ?? "Nao informado")} />
          <DetailItem label="Parcelas a pagar" value={String(calculation.remaining_installments ?? "Nao informado")} />
          <DetailItem label="Ano" value={calculation.vehicle_year ?? "Nao informado"} />
        </DetailSection>

        <DetailSection
          title="Resultado da simulacao"
          description="Comparativo entre o cenario atual do financiamento e a revisao estimada pela metodologia da planilha."
        >
          <DetailItem
            label="Quanto o cliente paga hoje no total"
            value={formatCalculationCurrency(calculation.current_total_financing)}
          />
          <DetailItem
            label="Quanto deveria pagar desde o comeco"
            value={formatCalculationCurrency(calculation.corrected_total_financing)}
          />
          <DetailItem
            label="Valor cobrado a maior"
            value={formatCalculationCurrency(calculation.estimated_savings)}
          />
          <DetailItem
            label="Valor atualmente para quitacao"
            value={formatCalculationCurrency(calculation.remaining_amount_to_pay)}
          />
          <DetailItem
            label="Juros abusivos por parcela"
            value={formatCalculationCurrency(
              calculation.abusive_interest_per_installment,
            )}
          />
          <DetailItem
            label="Juros abusivos ja pagos"
            value={formatCalculationCurrency(calculation.abusive_interest_paid)}
          />
          <DetailItem
            label="Divida real"
            value={formatCalculationCurrency(calculation.real_debt)}
          />
          <DetailItem
            label="Reducao estimada por parcela restante"
            value={formatCalculationCurrency(
              calculation.installment_reduction_remaining,
            )}
          />
        </DetailSection>

        <DetailSection title="Simulacao simplificada">
          <DetailItem
            label="Divida apos reducao de 30%"
            value={formatCalculationCurrency(calculation.debt_after_30_discount)}
          />
          <DetailItem
            label="Divida apos reducao de 90%"
            value={formatCalculationCurrency(calculation.debt_after_90_discount)}
          />
          <DetailItem
            label="50% de abatimento em 15x"
            value={formatCalculationCurrency(calculation.example_50_discount_15x)}
          />
          <DetailItem
            label="50% de abatimento em 10x"
            value={formatCalculationCurrency(calculation.example_50_discount_10x)}
          />
          <DetailItem
            label="50% de abatimento em 5x"
            value={formatCalculationCurrency(calculation.example_50_discount_5x)}
          />
          <DetailItem
            label="Reducao de 30% sobre o saldo restante"
            value={formatCalculationCurrency(calculation.discount_30_value)}
          />
          <DetailItem
            label="Reducao de 90% sobre o saldo restante"
            value={formatCalculationCurrency(calculation.discount_90_value)}
          />
        </DetailSection>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">PDF do cliente</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Gere a analise sintetizada no bucket privado e baixe por signed URL
            temporaria.
          </p>
          <div className="mt-5">
            <CalculationPdfActions
              calculationId={calculation.id}
              hasPdf={Boolean(calculation.pdf_storage_path)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Observacao final</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Todos os valores informados nesta simulacao foram baseados em taxas
            medias utilizadas pelo mercado na categoria de financiamentos
            bancarios. Os verdadeiros valores serao revogados e decididos
            posteriormente a prestacao de servicos.
          </p>
        </section>
      </div>
    </>
  );
}
