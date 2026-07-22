import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentDeleteButton } from "@/components/documents/document-delete-button";
import { DocumentRenderedContent } from "@/components/documents/document-rendered-content";
import { DocumentsNav } from "@/components/documents/documents-nav";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { displayValue, formatDateTime } from "@/lib/clients/formatters";
import { assertGeneratedDocumentAccess } from "@/lib/documents/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayName } from "@/lib/users/account";
import {
  documentStatusLabels,
  documentTemplateTypes,
  type DocumentTemplate,
  type GeneratedDocument,
} from "@/types/document";
import type { Client } from "@/types/client";
import type { UserProfileOption } from "@/types/pre-sale";

type DocumentoPageProps = {
  params: Promise<{ id: string }>;
};

function formatTemplateType(type: GeneratedDocument["document_type"]) {
  return documentTemplateTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function DocumentoPage({ params }: DocumentoPageProps) {
  const { id } = await params;
  const { supabase, companyId, role } = await getCurrentUserContext();
  const storageAdmin = createAdminClient();
  const canDeleteDocuments = role === "admin" || role === "manager";
  let document: GeneratedDocument | null = null;

  try {
    document = await assertGeneratedDocumentAccess(id);
  } catch {
    notFound();
  }

  if (!document) {
    notFound();
  }

  const [{ data: templateData }, { data: clientData }, { data: creatorData }] =
    await Promise.all([
      supabase
        .from("document_templates")
        .select("*")
        .eq("id", document.template_id)
        .maybeSingle(),
      document.client_id
        ? supabase
            .from("clients")
            .select("id, full_name")
            .eq("id", document.client_id)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      document.created_by
        ? supabase
            .from("user_profiles")
            .select("id, full_name, username, email, role")
            .eq("id", document.created_by)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const template = templateData as DocumentTemplate | null;
  const client = clientData as Pick<Client, "id" | "full_name"> | null;
  const creator = creatorData as UserProfileOption | null;
  const [
    { data: docxSignedUrl },
    { data: docxDownloadSignedUrl },
    { data: pdfSignedUrl },
    { data: pdfDownloadSignedUrl },
  ] = await Promise.all([
    document.generated_docx_path
      ? storageAdmin.storage
          .from("documents")
          .createSignedUrl(document.generated_docx_path, 60 * 10)
      : Promise.resolve({ data: null }),
    document.generated_docx_path
      ? storageAdmin.storage.from("documents").createSignedUrl(document.generated_docx_path, 60 * 10, {
          download: document.generated_docx_filename ?? "documento.docx",
        })
      : Promise.resolve({ data: null }),
    document.generated_pdf_path
      ? storageAdmin.storage
          .from("documents")
          .createSignedUrl(document.generated_pdf_path, 60 * 10)
      : Promise.resolve({ data: null }),
    document.generated_pdf_path
      ? storageAdmin.storage.from("documents").createSignedUrl(document.generated_pdf_path, 60 * 10, {
          download: document.generated_pdf_filename ?? "documento.pdf",
        })
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader
        title={document.title}
        description="Documento gerado e salvo a partir da pré-venda."
      />
      <div className="space-y-6 p-6">
        <DocumentsNav />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/documentos"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </Link>
          <Link
            href={`/pre-vendas/${document.pre_sale_id}`}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Abrir pré-venda
          </Link>
          {document.render_source === "html" ? (
            <Link
              href={`/documentos/gerados/${document.id}/imprimir?print=1`}
              target="_blank"
              className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
            >
              Abrir PDF HTML
            </Link>
          ) : null}
          {docxSignedUrl?.signedUrl ? (
            <>
              <Link
                href={docxSignedUrl.signedUrl}
                target="_blank"
                className="rounded-lg border border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
              >
                Abrir DOCX oficial
              </Link>
              {docxDownloadSignedUrl?.signedUrl ? (
                <Link
                  href={docxDownloadSignedUrl.signedUrl}
                  target="_blank"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Baixar DOCX oficial
                </Link>
              ) : null}
            </>
          ) : null}
          {pdfSignedUrl?.signedUrl ? (
            <>
              <Link
                href={pdfSignedUrl.signedUrl}
                target="_blank"
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Abrir PDF oficial
              </Link>
              {pdfDownloadSignedUrl?.signedUrl ? (
                <Link
                  href={pdfDownloadSignedUrl.signedUrl}
                  target="_blank"
                  className="rounded-lg border border-teal-300 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
                >
                  Baixar PDF oficial
                </Link>
              ) : null}
            </>
          ) : null}
          {canDeleteDocuments ? (
            <DocumentDeleteButton documentId={document.id} />
          ) : null}
        </div>

        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipo
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatTemplateType(document.document_type)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(client?.full_name ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Template
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {displayValue(template?.name ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {formatDateTime(document.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuário
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {resolveUserDisplayName(creator)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {document.pdf_error_message
                ? "DOCX gerado, PDF pendente"
                : documentStatusLabels[document.status] ?? displayValue(document.status)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fonte
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {document.render_source === "pdf"
                ? "PDF oficial"
                : document.render_source === "docx"
                  ? "DOCX oficial"
                  : "HTML"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Arquivos
            </p>
            <p className="mt-1 text-sm font-medium text-slate-950">
              {document.generated_docx_filename || document.generated_pdf_filename
                ? [document.generated_docx_filename, document.generated_pdf_filename]
                    .filter(Boolean)
                    .join(" / ")
                : "-"}
            </p>
          </div>
        </div>
        {document.pdf_error_message ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {document.pdf_error_message}
          </div>
        ) : null}

        {document.render_source === "html" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Preview HTML aproximado
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Quando o documento tiver DOCX ou PDF oficial, use os arquivos oficiais
              acima para conferir a versao fiel. Este preview serve apenas como
              referência rapida dentro do CRM.
            </p>
            <div className="mt-4 bg-slate-50 p-4">
              {document.rendered_content_html ? (
                <DocumentRenderedContent html={document.rendered_content_html} />
              ) : (
                <p className="text-sm text-slate-500">
                  Este documento foi gerado a partir do arquivo oficial e não possui
                  preview HTML salvo.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
