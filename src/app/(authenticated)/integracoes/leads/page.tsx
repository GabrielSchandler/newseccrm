import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLeadSourceAction,
  deleteLeadSourceAction,
  toggleLeadSourceAction,
  updateLeadSourceAction,
} from "./actions";

type LeadSourcesPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type LeadSource = {
  id: string;
  name: string;
  sheet_url: string;
  sheet_gid: string | null;
  start_row: number | null;
  name_column: string | null;
  phone_column: string | null;
  email_column: string | null;
  cpf_column: string | null;
  campaign_column: string | null;
  notes_column: string | null;
  is_active: boolean | null;
  last_checked_at: string | null;
  created_at: string | null;
};

function canManageLeadSources(role: string | null, isPlatformOwner: boolean) {
  return isPlatformOwner || role === "admin" || role === "manager";
}

function getBannerMessage(params: Awaited<LeadSourcesPageProps["searchParams"]>) {
  if (params.success === "created") {
    return { tone: "success" as const, text: "Fonte de leads cadastrada." };
  }

  if (params.success === "updated") {
    return { tone: "success" as const, text: "Fonte de leads atualizada." };
  }

  if (params.success === "deleted") {
    return { tone: "success" as const, text: "Fonte de leads removida." };
  }

  const errorMessages: Record<string, string> = {
    required: "Informe nome e link da planilha.",
    invalid_sheet: "Use um link valido do Google Sheets.",
    duplicated: "Ja existe uma fonte com este nome nesta empresa.",
    missing_source: "Fonte de leads nao encontrada.",
    save_failed: "Nao foi possivel salvar a fonte de leads.",
    delete_failed: "Nao foi possivel remover a fonte de leads.",
  };

  if (params.error) {
    return {
      tone: "error" as const,
      text: errorMessages[params.error] ?? "Nao foi possivel concluir a acao.",
    };
  }

  return null;
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? (
          <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
            Obrigatorio
          </span>
        ) : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
      />
    </label>
  );
}

export default async function LeadSourcesPage({ searchParams }: LeadSourcesPageProps) {
  const params = await searchParams;
  const { companyId, role, isPlatformOwner } = await getCurrentUserContext();

  if (!canManageLeadSources(role, isPlatformOwner)) {
    redirect("/areas");
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("lead_sources")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const sources = (data ?? []) as LeadSource[];
  const banner = getBannerMessage(params);

  return (
    <>
      <PageHeader
        title="Fontes de leads"
        description="Cadastre as planilhas do Google Sheets que cada empresa usa para receber leads do marketing."
      />
      <div className="space-y-6 p-6">
        {banner ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              banner.tone === "success"
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Configuracao
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Nova fonte do Google Sheets
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              A planilha precisa estar compartilhada para leitura por link. O CRM
              importa apenas linhas novas e guarda a origem para evitar duplicidade.
              Voce nao precisa preencher o ID da aba na maioria dos casos: se o
              link estiver aberto na aba correta, o CRM tenta identificar isso
              automaticamente.
            </p>
          </div>

          <form action={createLeadSourceAction} className="grid gap-4 p-6 lg:grid-cols-2">
            <Field
              label="Nome da fonte"
              name="name"
              required
              placeholder="Ex.: Trafego Kairos - Veiculos"
            />
            <Field
              label="Link da planilha"
              name="sheet_url"
              required
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <Field
              label="Primeira linha com lead"
              name="start_row"
              type="number"
              defaultValue={2}
              placeholder="2"
            />
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Configuracao avancada da aba
              </summary>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
                <Field
                  label="ID numerico da aba"
                  name="sheet_gid"
                  placeholder="Opcional. Ex.: 0 ou 123456789"
                />
                <p className="text-sm leading-6 text-slate-600">
                  Este campo nao e o nome da pagina/aba. Ele e o numero que aparece
                  no final do link como <span className="font-mono">#gid=...</span>.
                  Se ficar em branco, o CRM usa a primeira aba ou a aba que ja esta
                  no link informado.
                </p>
              </div>
            </details>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              <Field label="Coluna do nome" name="name_column" defaultValue="A" required />
              <Field label="Coluna do telefone" name="phone_column" defaultValue="B" />
              <Field label="Coluna do email" name="email_column" placeholder="Ex.: C" />
              <Field label="Coluna do CPF" name="cpf_column" placeholder="Ex.: D" />
              <Field label="Coluna da campanha" name="campaign_column" placeholder="Ex.: E" />
              <Field label="Coluna de observacoes" name="notes_column" placeholder="Ex.: F" />
            </div>
            <p className="text-sm leading-6 text-slate-600 lg:col-span-2">
              Dica: se a planilha tiver cabecalhos como Nome, Telefone, Midia e
              Observacao, o CRM tenta identificar as colunas automaticamente,
              mesmo que a configuracao acima esteja diferente.
            </p>
            <div className="lg:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Cadastrar fonte
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Planilhas cadastradas
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {sources.length} fonte(s)
              </h2>
            </div>
            <Link
              href="/leads"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ir para distribuicao
            </Link>
          </div>

          {error ? (
            <div className="m-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error.message}
            </div>
          ) : sources.length ? (
            <div className="divide-y divide-slate-100">
              {sources.map((source) => (
                <article key={source.id} className="grid gap-4 p-6 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">
                          {source.name}
                        </h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            source.is_active
                              ? "border-teal-200 bg-teal-50 text-teal-800"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {source.is_active ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <p className="mt-2 break-all text-sm text-slate-600">
                        {source.sheet_url}
                      </p>
                    </div>

                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Aba / linha
                        </dt>
                        <dd className="mt-1 text-slate-950">
                          {source.sheet_gid ? `GID ${source.sheet_gid}` : "Aba automatica"} /
                          linha {source.start_row ?? 2}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Colunas
                        </dt>
                        <dd className="mt-1 text-slate-950">
                          Nome {source.name_column ?? "A"} | Tel.{" "}
                          {displayValue(source.phone_column)}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Ultima verificacao
                        </dt>
                        <dd className="mt-1 text-slate-950">
                          {formatDateTime(source.last_checked_at)}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Criada em
                        </dt>
                        <dd className="mt-1 text-slate-950">
                          {formatDateTime(source.created_at)}
                        </dd>
                      </div>
                    </dl>

                    <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                        Editar conexao
                      </summary>
                      <form
                        action={updateLeadSourceAction}
                        className="mt-4 grid gap-4 lg:grid-cols-2"
                      >
                        <input type="hidden" name="source_id" value={source.id} />
                        <Field
                          label="Nome da fonte"
                          name="name"
                          required
                          defaultValue={source.name}
                        />
                        <Field
                          label="Link da planilha"
                          name="sheet_url"
                          required
                          defaultValue={source.sheet_url}
                        />
                        <Field
                          label="Primeira linha com lead"
                          name="start_row"
                          type="number"
                          defaultValue={source.start_row ?? 2}
                        />
                        <Field
                          label="ID numerico da aba"
                          name="sheet_gid"
                          defaultValue={source.sheet_gid ?? ""}
                          placeholder="Opcional. Nao use o nome da aba."
                        />
                        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
                          <Field
                            label="Coluna do nome"
                            name="name_column"
                            defaultValue={source.name_column ?? "A"}
                            required
                          />
                          <Field
                            label="Coluna do telefone"
                            name="phone_column"
                            defaultValue={source.phone_column ?? "B"}
                          />
                          <Field
                            label="Coluna do email"
                            name="email_column"
                            defaultValue={source.email_column ?? ""}
                            placeholder="Ex.: C"
                          />
                          <Field
                            label="Coluna do CPF"
                            name="cpf_column"
                            defaultValue={source.cpf_column ?? ""}
                            placeholder="Ex.: D"
                          />
                          <Field
                            label="Coluna da campanha"
                            name="campaign_column"
                            defaultValue={source.campaign_column ?? ""}
                            placeholder="Ex.: E"
                          />
                          <Field
                            label="Coluna de observacoes"
                            name="notes_column"
                            defaultValue={source.notes_column ?? ""}
                            placeholder="Ex.: F"
                          />
                        </div>
                        <p className="text-sm leading-6 text-slate-600 lg:col-span-2">
                          Se voce colocou o nome da aba no campo ID, deixe em branco
                          e salve. O CRM vai tentar identificar a aba pelo link.
                        </p>
                        <div className="lg:col-span-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                          >
                            Salvar alteracoes
                          </button>
                        </div>
                      </form>
                    </details>
                  </div>

                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <form action={toggleLeadSourceAction}>
                      <input type="hidden" name="source_id" value={source.id} />
                      <input
                        type="hidden"
                        name="next_active"
                        value={source.is_active ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {source.is_active ? "Pausar" : "Ativar"}
                      </button>
                    </form>
                    <form action={deleteLeadSourceAction}>
                      <input type="hidden" name="source_id" value={source.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                Nenhuma fonte cadastrada ainda.
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
