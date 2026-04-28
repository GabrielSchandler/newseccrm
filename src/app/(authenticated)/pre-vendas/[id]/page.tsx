import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ClientToast } from "@/components/clients/client-toast";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import { ClientDocumentsSection } from "@/components/client-documents/client-documents-section";
import { GenerateDocumentModal } from "@/components/documents/generate-document-modal";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesStatusBadge } from "@/components/pre-sales/pre-sales-status-badge";
import { PreSalesStatusSelect } from "@/components/pre-sales/pre-sales-status-select";
import {
  displayCpf,
  displayPhone,
  displayValue,
  formatDate,
  formatDateTime,
} from "@/lib/clients/formatters";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  formatBoolean,
  formatCurrency,
  formatPreSaleType,
  formatUserName,
} from "@/lib/pre-sales/formatters";
import type { DocumentTemplate } from "@/types/document";
import type {
  ClientOption,
  PreSale,
  PreSaleClientSnapshot,
  PreSaleDebtHolder,
  PreSaleFinancialCase,
  PreSalePayment,
  UserProfileOption,
} from "@/types/pre-sale";

type PreVendaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

type DetailSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function DetailSection({ title, description, children }: DetailSectionProps) {
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

export default async function PreVendaPage({ params, searchParams }: PreVendaPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { supabase, companyId, userProfileId, role } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("pre_sales")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  const preSale = data as PreSale | null;

  if (error || !preSale) {
    notFound();
  }

  const [
    { data: clientData },
    { data: consultantData },
    { data: creatorData },
    { data: snapshotData },
    { data: debtHolderData },
    { data: financialCaseData },
    { data: paymentsData },
    { data: templatesData },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, cpf, rg, birth_date, marital_status, profession, email, phone_mobile, phone_secondary, zip_code, street, number, district, city, state")
      .eq("id", preSale.client_id)
      .eq("company_id", companyId)
      .maybeSingle(),
    preSale.consultant_user_id
      ? supabase
          .from("user_profiles")
          .select("id, full_name, email, role")
          .eq("id", preSale.consultant_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("id", preSale.created_by)
      .maybeSingle(),
    supabase
      .from("pre_sale_client_snapshot")
      .select("*")
      .eq("pre_sale_id", preSale.id)
      .maybeSingle(),
    supabase
      .from("pre_sale_debt_holders")
      .select("*")
      .eq("pre_sale_id", preSale.id)
      .maybeSingle(),
    supabase
      .from("pre_sale_financial_cases")
      .select("*")
      .eq("pre_sale_id", preSale.id)
      .maybeSingle(),
    supabase
      .from("pre_sale_payments")
      .select("*")
      .eq("pre_sale_id", preSale.id)
      .order("installment_number", { ascending: true }),
    supabase
      .from("document_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const client = clientData as ClientOption | null;
  const consultant = consultantData as UserProfileOption | null;
  const creator = creatorData as UserProfileOption | null;
  const snapshot = snapshotData as PreSaleClientSnapshot | null;
  const debtHolder = debtHolderData as PreSaleDebtHolder | null;
  const financialCase = financialCaseData as PreSaleFinancialCase | null;
  const payments = (paymentsData ?? []) as PreSalePayment[];
  const templates = (templatesData ?? []) as DocumentTemplate[];
  const canEdit =
    role === "admin" ||
    role === "manager" ||
    preSale.consultant_user_id === userProfileId;
  const successMessage =
    queryParams.success === "created"
      ? "Pre-venda cadastrada com sucesso."
      : queryParams.success === "updated"
        ? "Pre-venda atualizada com sucesso."
        : null;

  return (
    <>
      <PageHeader
        title={snapshot?.full_name ?? client?.full_name ?? "Pre-venda"}
        description="Cadastro operacional completo da oportunidade."
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}
        <div className="flex flex-wrap gap-3">
          {canEdit ? (
            <Link
              href={`/pre-vendas/${preSale.id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Link>
          ) : null}
          <Link
            href="/pre-vendas"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para pre-vendas
          </Link>
          {client ? (
            <Link
              href={`/clientes/${client.id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir cliente
            </Link>
          ) : null}
          <Link
            href={`/calculos/novo?preSaleId=${preSale.id}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Criar calculo
          </Link>
          <GenerateDocumentModal preSaleId={preSale.id} templates={templates} />
          <WhatsAppLink phone={snapshot?.phone_mobile ?? client?.phone_mobile ?? null} />
        </div>

        <DetailSection title="Cabecalho">
          <DetailItem
            label="Status"
            value={
              <div className="flex flex-wrap items-center gap-3">
                <PreSalesStatusBadge status={preSale.status} />
                <PreSalesStatusSelect
                  preSaleId={preSale.id}
                  status={preSale.status}
                  disabled={!canEdit}
                />
              </div>
            }
          />
          <DetailItem label="Tipo" value={formatPreSaleType(preSale.pre_sale_type)} />
          <DetailItem label="Servico" value={displayValue(preSale.service_type)} />
          <DetailItem label="Midia" value={displayValue(preSale.media)} />
          <DetailItem label="Consultor" value={formatUserName(consultant)} />
          <DetailItem label="Criado por" value={formatUserName(creator)} />
          <DetailItem label="Data de abertura" value={formatDateTime(preSale.created_at)} />
          <DetailItem
            label="Ultima atualizacao"
            value={formatDateTime(preSale.updated_at)}
          />
        </DetailSection>

        <DetailSection
          title="Contratante"
          description="Snapshot preservado para contrato e ordem de servico."
        >
          <DetailItem label="Nome" value={displayValue(snapshot?.full_name ?? null)} />
          <DetailItem label="CPF" value={displayCpf(snapshot?.cpf ?? null)} />
          <DetailItem label="RG" value={displayValue(snapshot?.rg ?? null)} />
          <DetailItem label="Nascimento" value={formatDate(snapshot?.birth_date ?? null)} />
          <DetailItem label="Estado civil" value={displayValue(snapshot?.marital_status ?? null)} />
          <DetailItem label="Profissao" value={displayValue(snapshot?.profession ?? null)} />
          <DetailItem label="Email" value={displayValue(snapshot?.email ?? null)} />
          <DetailItem label="Celular" value={displayPhone(snapshot?.phone_mobile ?? null)} />
          <DetailItem label="Telefone secundario" value={displayPhone(snapshot?.phone_secondary ?? null)} />
          <DetailItem label="CEP" value={displayValue(snapshot?.zip_code ?? null)} />
          <DetailItem label="Rua" value={displayValue(snapshot?.street ?? null)} />
          <DetailItem label="Numero" value={displayValue(snapshot?.number ?? null)} />
          <DetailItem label="Bairro" value={displayValue(snapshot?.district ?? null)} />
          <DetailItem label="Cidade" value={displayValue(snapshot?.city ?? null)} />
          <DetailItem label="Estado" value={displayValue(snapshot?.state ?? null)} />
        </DetailSection>

        <DetailSection title="Titular da divida">
          <DetailItem label="Nome" value={displayValue(debtHolder?.full_name ?? null)} />
          <DetailItem label="CPF" value={displayCpf(debtHolder?.cpf ?? null)} />
          <DetailItem label="RG" value={displayValue(debtHolder?.rg ?? null)} />
          <DetailItem label="Nascimento" value={formatDate(debtHolder?.birth_date ?? null)} />
          <DetailItem label="Estado civil" value={displayValue(debtHolder?.marital_status ?? null)} />
          <DetailItem label="Profissao" value={displayValue(debtHolder?.profession ?? null)} />
          <DetailItem label="Nacionalidade" value={displayValue(debtHolder?.nationality ?? null)} />
          <DetailItem label="Orgao emissor" value={displayValue(debtHolder?.issuer_agency ?? null)} />
          <DetailItem label="Pai" value={displayValue(debtHolder?.father_name ?? null)} />
          <DetailItem label="Mae" value={displayValue(debtHolder?.mother_name ?? null)} />
          <DetailItem label="Celular" value={displayPhone(debtHolder?.phone_mobile ?? null)} />
          <DetailItem label="Telefone secundario" value={displayPhone(debtHolder?.phone_secondary ?? null)} />
          <DetailItem label="Email" value={displayValue(debtHolder?.email ?? null)} />
          <DetailItem label="CEP" value={displayValue(debtHolder?.zip_code ?? null)} />
          <DetailItem label="Rua" value={displayValue(debtHolder?.street ?? null)} />
          <DetailItem label="Numero" value={displayValue(debtHolder?.number ?? null)} />
          <DetailItem label="Bairro" value={displayValue(debtHolder?.district ?? null)} />
          <DetailItem label="Cidade" value={displayValue(debtHolder?.city ?? null)} />
          <DetailItem label="Estado" value={displayValue(debtHolder?.state ?? null)} />
        </DetailSection>

        <DetailSection title="Dados financeiros">
          <DetailItem label="Financeira" value={displayValue(financialCase?.financer_name ?? null)} />
          <DetailItem
            label="Possui contrato de financiamento?"
            value={formatBoolean(financialCase?.has_financing_contract)}
          />
          <DetailItem label="Valor financiado" value={formatCurrency(financialCase?.financed_amount ?? null)} />
          <DetailItem label="Valor da parcela" value={formatCurrency(financialCase?.installment_amount ?? null)} />
          <DetailItem label="Parcelas pagas" value={displayValue(financialCase?.paid_installments === null || financialCase?.paid_installments === undefined ? null : String(financialCase.paid_installments))} />
          <DetailItem label="Parcelas em atraso" value={displayValue(financialCase?.overdue_installments === null || financialCase?.overdue_installments === undefined ? null : String(financialCase.overdue_installments))} />
          <DetailItem label="Dia do vencimento" value={displayValue(financialCase?.due_day === null || financialCase?.due_day === undefined ? null : String(financialCase.due_day))} />
          <DetailItem label="Numero do contrato" value={displayValue(financialCase?.contract_number ?? null)} />
        </DetailSection>

        {preSale.pre_sale_type === "veiculo" ? (
          <DetailSection title="Dados do veiculo">
            <DetailItem label="Veiculo" value={displayValue(financialCase?.asset_brand_model ?? null)} />
            <DetailItem label="Cor" value={displayValue(financialCase?.asset_color ?? null)} />
            <DetailItem label="Ano" value={displayValue(financialCase?.asset_year === null || financialCase?.asset_year === undefined ? null : String(financialCase.asset_year))} />
            <DetailItem label="Placa" value={displayValue(financialCase?.asset_plate ?? null)} />
          </DetailSection>
        ) : null}

        <DetailSection title="Contratacao e negociacao">
          <DetailItem label="Valor do contrato" value={formatCurrency(preSale.contract_value)} />
          <DetailItem
            label="Descricao livre da contratacao / informe"
            className="md:col-span-2"
            value={
              <p className="whitespace-pre-line">
                {displayValue(preSale.negotiation_details)}
              </p>
            }
          />
        </DetailSection>

        <DetailSection title="Pagamentos previstos">
          {payments.length ? (
            <div className="overflow-x-auto md:col-span-2">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parcela</th>
                    <th className="px-4 py-3 font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold">Forma</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment, index) => (
                    <tr key={`${payment.installment_number ?? index}-${payment.payment_date ?? ""}`}>
                      <td className="px-4 py-3">
                        {payment.installment_number ?? index + 1}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(payment.amount ?? null)}</td>
                      <td className="px-4 py-3">
                        {displayValue(payment.payment_method)}
                      </td>
                      <td className="px-4 py-3">{formatDate(payment.payment_date ?? null)}</td>
                      <td className="px-4 py-3">{displayValue(payment.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600 md:col-span-2">
              Nenhum pagamento previsto cadastrado.
            </p>
          )}
        </DetailSection>

        <ClientDocumentsSection
          clientId={preSale.client_id}
          preSaleId={preSale.id}
          title="Anexos da operacao"
          description="Documentos privados vinculados a esta pre-venda e ao cliente da operacao."
        />
      </div>
    </>
  );
}
