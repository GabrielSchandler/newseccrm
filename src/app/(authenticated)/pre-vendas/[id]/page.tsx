import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientToast } from "@/components/clients/client-toast";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import { PageHeader } from "@/components/layout/page-header";
import { PreSalesStatusBadge } from "@/components/pre-sales/pre-sales-status-badge";
import { PreSalesStatusSelect } from "@/components/pre-sales/pre-sales-status-select";
import { formatDateTime } from "@/lib/clients/formatters";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatCurrency, formatUserName } from "@/lib/pre-sales/formatters";
import type { ClientOption, PreSale, UserProfileOption } from "@/types/pre-sale";

type PreVendaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

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

  const [{ data: clientData }, { data: consultantData }, { data: creatorData }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, cpf, phone_mobile")
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
    ]);

  const client = clientData as ClientOption | null;
  const consultant = consultantData as UserProfileOption | null;
  const creator = creatorData as UserProfileOption | null;
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
        title={client?.full_name ?? "Pre-venda"}
        description="Dados completos da oportunidade comercial."
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
          <WhatsAppLink phone={client?.phone_mobile ?? null} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <PreSalesStatusBadge status={preSale.status} />
                <PreSalesStatusSelect
                  preSaleId={preSale.id}
                  status={preSale.status}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Valor estimado
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatCurrency(preSale.estimated_contract_value)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Consultor
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatUserName(consultant)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo de servico
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {preSale.service_type || "-"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Observacoes
              </p>
              <p className="mt-1 whitespace-pre-line text-sm font-medium text-slate-950">
                {preSale.negotiation_notes || "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Historico basico</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Criado por
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatUserName(creator)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Criado em
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatDateTime(preSale.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ultima atualizacao
              </p>
              <p className="mt-1 text-sm font-medium text-slate-950">
                {formatDateTime(preSale.updated_at)}
              </p>
            </div>
            {preSale.status === "aprovado" ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 md:col-span-2">
                Pre-venda aprovada. Esta estrutura esta pronta para conversao em contrato,
                comissao e relatorios em uma etapa futura.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
