import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentPrintActions } from "@/components/documents/document-print-actions";
import { DocumentRenderedContent } from "@/components/documents/document-rendered-content";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { assertGeneratedDocumentAccess } from "@/lib/documents/access";
import type { GeneratedDocument } from "@/types/document";

type PrintDocumentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
};

export default async function PrintDocumentPage({
  params,
  searchParams,
}: PrintDocumentPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await getCurrentUserContext();
  let document: GeneratedDocument | null = null;

  try {
    document = await assertGeneratedDocumentAccess(id);
  } catch {
    notFound();
  }

  if (!document) {
    notFound();
  }

  if (document.render_source === "pdf" && document.generated_pdf_path) {
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.generated_pdf_path, 60 * 10);

    if (!signedUrlError && signedUrlData?.signedUrl) {
      redirect(signedUrlData.signedUrl);
    }
  }

  if (document.render_source === "docx") {
    if (document.generated_pdf_path) {
      const { data: signedPdfUrlData, error: signedPdfUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.generated_pdf_path, 60 * 10);

      if (!signedPdfUrlError && signedPdfUrlData?.signedUrl) {
        redirect(signedPdfUrlData.signedUrl);
      }
    }

    if (document.generated_docx_path) {
      const { data: signedDocxUrlData, error: signedDocxUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.generated_docx_path, 60 * 10);

      if (!signedDocxUrlError && signedDocxUrlData?.signedUrl) {
        redirect(signedDocxUrlData.signedUrl);
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-base font-semibold text-slate-950">{document.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use Baixar PDF e escolha Salvar como PDF na janela do navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/documentos/gerados/${document.id}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </Link>
          <DocumentPrintActions autoPrint={query.print === "1"} />
        </div>
      </div>

      <article className="mx-auto max-w-[794px] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <DocumentRenderedContent
          html={document.rendered_content_html}
          variant="print"
        />
      </article>
    </main>
  );
}
