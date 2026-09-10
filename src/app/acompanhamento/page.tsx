import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileSearch,
  FileText,
  LockKeyhole,
  Search,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { displayCpf, formatDate, formatDateTime } from "@/lib/clients/formatters";
import { formatPreSaleType } from "@/lib/pre-sales/formatters";
import { checkPublicTrackingRateLimit } from "@/lib/security/public-tracking-rate-limit";
import {
  formatClientTrackingStatus,
  type ClientTrackingStatus,
  type ClientTrackingUpdate,
} from "@/types/client-tracking";
import type { ClientDocument } from "@/types/client-document";
import type { PreSale, PreSaleType } from "@/types/pre-sale";

export const dynamic = "force-dynamic";

type AcompanhamentoPageProps = {
  searchParams: Promise<{
    cpf?: string;
    protocolo?: string;
  }>;
};

type PublicClient = {
  id: string;
  company_id: string;
  full_name: string;
  cpf: string | null;
};

type PublicCompany = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
};

type PublicTrackingUpdate = Pick<
  ClientTrackingUpdate,
  "id" | "title" | "description" | "status" | "event_at"
>;

type PublicClientDocument = Pick<
  ClientDocument,
  | "id"
  | "title"
  | "description"
  | "file_name"
  | "file_path"
  | "mime_type"
  | "created_at"
  | "client_access_reviewed_at"
  | "client_download_requested"
> & {
  download_url: string | null;
};

function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeProtocol(value: string | null | undefined) {
  return onlyDigits(value);
}

function getFirstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function getStatusClassName(status: ClientTrackingStatus | string | null) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-teal-200 bg-teal-50 text-teal-700";
}

function getStatusIcon(status: ClientTrackingStatus | string | null) {
  return status === "completed" ? CheckCircle2 : Clock3;
}

async function findTrackingResult(cpf: string, protocol: string) {
  if (cpf.length !== 11 || !protocol) {
    return null;
  }

  const adminSupabase = createAdminClient();
  const formattedCpf = displayCpf(cpf);
  const { data: clientsData, error: clientsError } = await adminSupabase
    .from("clients")
    .select("id, company_id, full_name, cpf")
    .or(`cpf.eq.${cpf},cpf.eq.${formattedCpf}`)
    .is("deleted_at", null)
    .limit(20);

  if (clientsError) {
    throw clientsError;
  }

  const clients = (clientsData ?? []) as PublicClient[];

  if (!clients.length) {
    return null;
  }

  const { data: preSaleData, error: preSaleError } = await adminSupabase
    .from("pre_sales")
    .select(
      "id, company_id, client_id, tracking_protocol, created_at, status, pre_sale_type, service_type",
    )
    .in(
      "client_id",
      clients.map((client) => client.id),
    )
    .eq("tracking_protocol", protocol)
    .limit(1);

  if (preSaleError) {
    throw preSaleError;
  }

  const preSale = (preSaleData?.[0] ?? null) as
    | Pick<
        PreSale,
        | "id"
        | "company_id"
        | "client_id"
        | "tracking_protocol"
        | "created_at"
        | "status"
        | "pre_sale_type"
        | "service_type"
      >
    | null;

  if (!preSale) {
    return null;
  }

  const client = clients.find((item) => item.id === preSale.client_id) ?? null;

  if (!client) {
    return null;
  }

  const [companyResult, updatesResult, documentsResult] = await Promise.all([
    adminSupabase
      .from("companies")
      .select("id, trade_name, legal_name")
      .eq("id", preSale.company_id)
      .maybeSingle(),
    adminSupabase
      .from("client_tracking_updates")
      .select("id, title, description, status, event_at")
      .eq("company_id", preSale.company_id)
      .eq("client_id", client.id)
      .eq("pre_sale_id", preSale.id)
      .eq("visible_to_client", true)
      .eq("approval_status", "approved")
      .is("deleted_at", null)
      .order("event_at", { ascending: false })
      .order("created_at", { ascending: false }),
    adminSupabase
      .from("client_documents")
      .select(
        "id, title, description, file_name, file_path, mime_type, created_at, client_access_reviewed_at, client_download_requested",
      )
      .eq("company_id", preSale.company_id)
      .eq("client_id", client.id)
      .eq("pre_sale_id", preSale.id)
      .eq("document_type", "extrajudicial")
      .eq("client_access_status", "approved")
      .eq("client_visibility_requested", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (companyResult.error) throw companyResult.error;
  if (updatesResult.error) throw updatesResult.error;
  if (documentsResult.error) throw documentsResult.error;

  const documents = (documentsResult.data ?? []) as Array<
    Omit<PublicClientDocument, "download_url">
  >;
  const publicDocuments = await Promise.all(
    documents.map(async (document) => {
      if (!document.client_download_requested) {
        return { ...document, download_url: null };
      }

      const { data: signedData, error: signedError } = await adminSupabase.storage
        .from("client-documents")
        .createSignedUrl(document.file_path, 60 * 10, {
          download: document.file_name,
        });

      return {
        ...document,
        download_url: signedError ? null : signedData?.signedUrl ?? null,
      };
    }),
  );

  return {
    client,
    preSale,
    company: companyResult.data as PublicCompany | null,
    updates: (updatesResult.data ?? []) as PublicTrackingUpdate[],
    documents: publicDocuments,
  };
}

export default async function AcompanhamentoPage({
  searchParams,
}: AcompanhamentoPageProps) {
  const params = await searchParams;
  const cpf = onlyDigits(params.cpf);
  const protocolo = normalizeProtocol(params.protocolo);
  const hasSearch = Boolean(params.cpf || params.protocolo);
  const hasValidSearch = cpf.length === 11 && Boolean(protocolo);
  const rateLimitStatus = hasValidSearch
    ? await checkPublicTrackingRateLimit(cpf)
    : "allowed";
  const result =
    hasValidSearch && rateLimitStatus === "allowed"
      ? await findTrackingResult(cpf, protocolo)
      : null;
  const companyName =
    result?.company?.trade_name?.trim() ||
    result?.company?.legal_name?.trim() ||
    "a empresa";

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5f7f6_100%)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-10 md:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Acompanhamento do contrato
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 md:text-5xl">
              Consulte o andamento do seu contrato com segurança.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Informe CPF e protocolo para acompanhar as movimentações liberadas
              pela nossa equipe. A consulta mostra apenas dados essenciais do
              seu atendimento.
            </p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-white px-5 py-4 text-sm leading-6 text-teal-900 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <LockKeyhole className="h-4 w-4" />
              Consulta protegida
            </div>
            <p className="mt-1 max-w-sm">
              Nenhum documento pessoal é exibido. Somente movimentações e
              arquivos extrajudiciais aprovados pela equipe ficam disponíveis.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Localizar acompanhamento
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O protocolo fica no atendimento da sua contratação. Em caso de
              dúvida, fale com a nossa equipe.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  CPF do contratante
                </span>
                <input
                  name="cpf"
                  defaultValue={params.cpf ?? ""}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Protocolo
                </span>
                <input
                  name="protocolo"
                  defaultValue={params.protocolo ?? ""}
                  placeholder="Ex.: 20260615-0000"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Search className="h-4 w-4" />
                Consultar andamento
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {!hasSearch ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                  <FileSearch className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">
                  Seu acompanhamento aparece aqui.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Assim que CPF e protocolo forem informados, exibiremos uma
                  linha do tempo objetiva com as movimentações publicadas pela equipe.
                </p>
              </div>
            ) : rateLimitStatus === "blocked" ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <LockKeyhole className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">
                  Aguarde antes de tentar novamente.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  O limite temporário de consultas foi atingido. Tente novamente
                  em alguns minutos ou fale com nossa equipe.
                </p>
              </div>
            ) : rateLimitStatus === "unavailable" ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                  <LockKeyhole className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">
                  Consulta temporariamente indisponível.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Não foi possível validar esta consulta com segurança. Tente
                  novamente em alguns minutos.
                </p>
              </div>
            ) : result ? (
              <div>
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbfa_0%,#eef8f5_100%)] px-6 py-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                    {companyName}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    Olá, {getFirstName(result.client.full_name)}.
                  </h2>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Protocolo
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {result.preSale.tracking_protocol}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Contratação
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatDate(result.preSale.created_at)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Atendimento
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatPreSaleType(result.preSale.pre_sale_type as PreSaleType)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  {result.updates.length ? (
                    <div className="relative space-y-5 before:absolute before:left-5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
                      {result.updates.map((update) => {
                        const Icon = getStatusIcon(update.status);

                        return (
                          <article key={update.id} className="relative pl-14">
                            <div
                              className={`absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-lg border ${getStatusClassName(
                                update.status,
                              )}`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                                    update.status,
                                  )}`}
                                >
                                  {formatClientTrackingStatus(update.status)}
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {formatDateTime(update.event_at)}
                                </span>
                              </div>
                              <h3 className="mt-3 text-lg font-semibold text-slate-950">
                                {update.title}
                              </h3>
                              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                                {update.description}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                      <p className="text-base font-semibold text-slate-950">
                        Ainda não há movimentações publicadas.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        O atendimento foi localizado, mas nossa equipe ainda não
                        liberou uma atualização pública para este protocolo.
                      </p>
                    </div>
                  )}
                </div>

                <section className="border-t border-slate-200 px-6 py-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        Documentos extrajudiciais
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        A disponibilidade para download depende da autorização
                        concedida pela equipe responsável.
                      </p>
                    </div>
                  </div>

                  {result.documents.length ? (
                    <div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                      {result.documents.map((document) => (
                        <article
                          key={document.id}
                          className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="break-words font-semibold text-slate-950">
                                {document.title || document.file_name}
                              </h4>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Documento registrado
                              </span>
                            </div>
                            {document.description ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {document.description}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs font-medium text-slate-500">
                              Disponibilizado em{" "}
                              {formatDate(
                                document.client_access_reviewed_at ?? document.created_at,
                              )}
                            </p>
                          </div>
                          {document.download_url ? (
                            <a
                              href={document.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                            >
                              <Download className="h-4 w-4" />
                              Baixar arquivo
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                              Download não liberado
                            </span>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                      Nenhum documento extrajudicial foi liberado para este
                      protocolo até o momento.
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700">
                  <FileSearch className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">
                  Não encontramos esse acompanhamento.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Confira CPF e protocolo. Se as informações estiverem corretas,
                  nossa equipe pode confirmar o número do seu atendimento.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
          <p>
            Esta página exibe somente movimentações liberadas para consulta do
            cliente.
          </p>
          <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">
            Acesso interno
          </Link>
        </div>
      </section>
    </main>
  );
}
