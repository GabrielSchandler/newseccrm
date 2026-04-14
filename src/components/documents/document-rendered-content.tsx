type DocumentRenderedContentProps = {
  html: string;
  variant?: "screen" | "print";
};

export function DocumentRenderedContent({
  html,
  variant = "screen",
}: DocumentRenderedContentProps) {
  return (
    <div
      className={
        variant === "print"
          ? "document-content document-content-print"
          : "document-content rounded-lg border border-slate-200 bg-white p-8 text-slate-950"
      }
    >
      <style>
        {`
          .document-content {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
            line-height: 1.65;
            color: #0f172a;
            overflow-wrap: anywhere;
          }
          .document-content h1,
          .document-content h2,
          .document-content h3,
          .document-content h4,
          .document-content h5,
          .document-content h6 {
            color: #020617;
            font-weight: 700;
            line-height: 1.25;
            margin: 1.25em 0 0.55em;
          }
          .document-content h1 { font-size: 26px; }
          .document-content h2 { font-size: 22px; }
          .document-content h3 { font-size: 18px; }
          .document-content p { margin: 0 0 0.85em; }
          .document-content ul,
          .document-content ol {
            margin: 0 0 1em 1.5em;
            padding: 0;
          }
          .document-content li { margin: 0.25em 0; }
          .document-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            page-break-inside: auto;
          }
          .document-content tr { page-break-inside: avoid; }
          .document-content th,
          .document-content td {
            border: 1px solid #cbd5e1;
            padding: 8px;
            vertical-align: top;
          }
          .document-content th {
            background: #f8fafc;
            font-weight: 700;
          }
          .document-content img {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0.75em auto;
          }
          .document-content a {
            color: #0f766e;
            text-decoration: underline;
          }
          .document-content blockquote {
            border-left: 3px solid #94a3b8;
            margin: 1em 0;
            padding-left: 1em;
            color: #334155;
          }
          .document-content-print {
            min-height: 100vh;
            background: #ffffff;
          }
          @media print {
            @page {
              size: A4;
              margin: 14mm;
            }
            html,
            body {
              background: #ffffff !important;
            }
            .document-content {
              border: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
