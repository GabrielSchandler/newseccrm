import { Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { ClientToast } from "@/components/clients/client-toast";
import { CopyButton } from "@/components/clients/copy-button";
import { ReactivateClientButton } from "@/components/clients/reactivate-client-button";
import { WhatsAppLink } from "@/components/clients/whatsapp-link";
import { ClientDocumentsSection } from "@/components/client-documents/client-documents-section";
import { ClientCalculationsSection } from "@/components/calculations/client-calculations-section";
import { PageHeader } from "@/components/layout/page-header";
import {
  displayCpf,
  displayPhone,
  displayValue,
  formatDate,
  formatDateTime,
} from "@/lib/clients/formatters";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import type { Client, ClientAuditUser } from "@/types/client";
import { isDeletedClient } from "@/lib/clients/status";

type ClientePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
};

const personalDetails = [
  ["CPF", "cpf"],
  ["RG", "rg"],
  ["Nascimento", "birth_date"],
  ["Estado civil", "marital_status"],
  ["Profissao", "profession"],
] as const;

const contactDetails = [
  ["Email", "email"],
  ["Celular", "phone_mobile"],
  ["Telefone secundario", "phone_secondary"],
] as const;

const addressDetails = [
  ["CEP", "zip_code"],
  ["Rua", "street"],
  ["Numero", "number"],
  ["Bairro", "district"],
  ["Cidade", "city"],
  ["Estado", "state"],
] as const;

export default async function ClientePage({
  params,
  searchParams,
}: ClientePageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { supabase, companyId, role } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  const client = data as Client | null;

  if (error || !client) {
    notFound();
  }

  const { data: createdByProfileData } = await supabase
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", client.created_by)
    .maybeSingle();
  const createdByProfile = createdByProfileData as ClientAuditUser | null;
  const successMessage =
    queryParams.success === "created"
      ? "Cliente cadastrado com sucesso."
      : queryParams.success === "updated"
        ? "Cliente atualizado com sucesso."
        : queryParams.success === "reactivated"
          ? "Cliente reativado com sucesso."
          : null;

  return (
    <>
      <PageHeader
        title={client.full_name}
        description={
          isDeletedClient(client)
            ? "Este cliente esta excluido e nao aparece na listagem padrao."
            : "Dados cadastrados do cliente selecionado."
        }
      />
      <div className="space-y-6 p-6">
        {successMessage ? <ClientToast message={successMessage} /> : null}

        <div className="flex flex-wrap gap-3">
          {isDeletedClient(client) ? null : (
            <Link
              href={`/clientes/${client.id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Link>
          )}
          <Link
            href="/clientes"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para clientes
          </Link>
          <WhatsAppLink phone={client.phone_mobile} />
          {!isDeletedClient(client) ? (
            <DeleteClientButton clientId={client.id} />
          ) : null}
          {role === "admin" && isDeletedClient(client) ? (
            <ReactivateClientButton clientId={client.id} />
          ) : null}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <ClientStatusBadge client={client} />
          </div>
          <div className="space-y-8">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Dados pessoais</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {personalDetails.map(([label, key]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-950">
                      {key === "birth_date" ? formatDate(client[key]) : null}
                      {key === "cpf" ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {displayCpf(client[key])}
                          <CopyButton value={displayCpf(client[key])} label="Copiar" />
                        </span>
                      ) : null}
                      {key !== "birth_date" && key !== "cpf"
                        ? displayValue(client[key])
                        : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-950">Contato</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {contactDetails.map(([label, key]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-950">
                      {key === "phone_mobile" || key === "phone_secondary" ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {displayPhone(client[key])}
                          {client[key] ? (
                            <CopyButton value={displayPhone(client[key])} label="Copiar" />
                          ) : null}
                        </span>
                      ) : (
                        displayValue(client[key])
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-950">Endereco</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {addressDetails.map(([label, key]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-950">
                      {displayValue(client[key])}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-950">Auditoria</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criado em
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-950">
                    {formatDateTime(client.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criado por
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-950">
                    {displayValue(
                      createdByProfile?.full_name ?? createdByProfile?.email ?? null,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ultima atualizacao
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-950">
                    {formatDateTime(client.updated_at)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-950">Observacoes</h2>
              <p className="mt-3 whitespace-pre-line text-sm font-medium text-slate-950">
                {displayValue(client.notes)}
              </p>
            </div>
          </div>
        </section>

        <ClientDocumentsSection
          clientId={client.id}
          title="Documentos do cliente"
          description="Anexe e consulte documentos vinculados a este cliente usando links temporarios e bucket privado."
        />

        <ClientCalculationsSection clientId={client.id} />
      </div>
    </>
  );
}
