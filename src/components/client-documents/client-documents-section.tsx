import { ClientDocumentWorkspace } from "@/components/client-documents/client-document-workspace";
import {
  canModifyClientDocuments,
  listClientDocumentsByClient,
  listClientDocumentsByPreSale,
  listUploaderProfiles,
} from "@/lib/client-documents/service";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { resolveUserDisplayName } from "@/lib/users/account";

type ClientDocumentsSectionProps = {
  clientId: string;
  preSaleId?: string | null;
  title: string;
  description?: string;
};

export async function ClientDocumentsSection({
  clientId,
  preSaleId = null,
  title,
  description,
}: ClientDocumentsSectionProps) {
  const { role, businessArea } = await getCurrentUserContext();
  const documents = preSaleId
    ? await listClientDocumentsByPreSale(clientId, preSaleId)
    : await listClientDocumentsByClient(clientId);
  const uploaders = await listUploaderProfiles(documents.map((document) => document.uploaded_by ?? ""));
  const uploaderMap = new Map(
    uploaders.map((user) => [user.id, resolveUserDisplayName(user, "") || null]),
  );
  const enrichedDocuments = documents.map((document) => ({
    ...document,
    uploaded_by_name: document.uploaded_by
      ? (uploaderMap.get(document.uploaded_by) ?? null)
      : null,
  }));

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      <ClientDocumentWorkspace
        clientId={clientId}
        preSaleId={preSaleId}
        documents={enrichedDocuments}
        canManage={canModifyClientDocuments(role, businessArea)}
      />
    </section>
  );
}
