"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { IConfig } from "@onlyoffice/document-editor-react";

const OnlyOfficeDocumentEditor = dynamic(
  async () => {
    const onlyOfficeModule = await import("@onlyoffice/document-editor-react");
    return onlyOfficeModule.DocumentEditor;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[840px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Carregando editor OnlyOffice...
      </div>
    ),
  },
);

type OnlyOfficeTemplateEditorProps = {
  documentServerUrl: string;
  config: IConfig;
};

export function OnlyOfficeTemplateEditor({
  documentServerUrl,
  config,
}: OnlyOfficeTemplateEditorProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editorId = useMemo(
    () => `onlyoffice-template-${config.document?.key ?? "editor"}`,
    [config.document?.key],
  );

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <OnlyOfficeDocumentEditor
          id={editorId}
          documentServerUrl={documentServerUrl}
          config={config}
          height="840px"
          width="100%"
          onLoadComponentError={(errorCode, errorDescription) => {
            const label =
              errorCode === -2
                ? "Nao foi possivel carregar o script do OnlyOffice."
                : errorCode === -3
                  ? "O DocsAPI do OnlyOffice nao respondeu como esperado."
                  : "O editor OnlyOffice nao carregou corretamente.";

            setErrorMessage(`${label} ${errorDescription || ""}`.trim());
          }}
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        O template oficial esta sendo editado diretamente em DOCX. Use os placeholders
        no proprio documento e salve normalmente no editor. O CRM recebe a versao
        atualizada sem reconverter o contrato para HTML. Depois do salvamento,
        recarregue a pagina para conferir a data atualizada do arquivo oficial.
      </div>
    </div>
  );
}
