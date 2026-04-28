import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { IConfig } from "@onlyoffice/document-editor-react";
import type { DocumentCompany } from "@/lib/documents/template-engine";
import type { DocumentTemplate } from "@/types/document";

type OnlyOfficeCallbackPayload = {
  templateId: string;
  companyId: string;
  storagePath: string;
};

type OnlyOfficeUser = {
  id: string;
  name: string;
};

function buildStableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getOnlyOfficeDocumentServerUrl() {
  return (
    process.env.NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL ||
    process.env.ONLYOFFICE_DOCUMENT_SERVER_URL ||
    ""
  ).replace(/\/+$/, "");
}

function getOnlyOfficeConfigSecret() {
  return process.env.ONLYOFFICE_JWT_SECRET || "";
}

function getOnlyOfficeCallbackSecret() {
  return (
    process.env.ONLYOFFICE_CALLBACK_SECRET ||
    process.env.ONLYOFFICE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function buildCompanyDisplayName(company: DocumentCompany | null) {
  if (!company) {
    return "CRM SaaS";
  }

  return (
    company.trade_name ||
    company.fantasy_name ||
    company.nome_fantasia ||
    company.legal_name ||
    company.corporate_name ||
    company.razao_social ||
    "CRM SaaS"
  );
}

export function isOnlyOfficeConfigured() {
  return Boolean(getOnlyOfficeDocumentServerUrl() && getOnlyOfficeCallbackSecret());
}

export function getOnlyOfficeMissingConfigReason() {
  if (!getOnlyOfficeDocumentServerUrl()) {
    return "Defina NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL para abrir o editor DOCX nativo.";
  }

  if (!getOnlyOfficeCallbackSecret()) {
    return "Defina ONLYOFFICE_CALLBACK_SECRET ou ONLYOFFICE_JWT_SECRET para salvar o DOCX editado de volta no CRM.";
  }

  return null;
}

export function buildOnlyOfficeCallbackToken(payload: OnlyOfficeCallbackPayload) {
  const secret = getOnlyOfficeCallbackSecret();

  if (!secret) {
    throw new Error(getOnlyOfficeMissingConfigReason() || "OnlyOffice nao configurado.");
  }

  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "12h",
  });
}

export function verifyOnlyOfficeCallbackToken(token: string) {
  const secret = getOnlyOfficeCallbackSecret();

  if (!secret) {
    throw new Error(getOnlyOfficeMissingConfigReason() || "OnlyOffice nao configurado.");
  }

  return jwt.verify(token, secret) as OnlyOfficeCallbackPayload;
}

export function buildOnlyOfficeDocumentKey(template: DocumentTemplate) {
  return buildStableHash(
    [
      template.id,
      template.updated_at ?? template.created_at,
      template.original_docx_path ?? "",
      template.original_docx_uploaded_at ?? "",
    ].join(":"),
  ).slice(0, 40);
}

export function buildOnlyOfficeEditorConfig(options: {
  template: DocumentTemplate;
  documentUrl: string;
  callbackUrl: string;
  user: OnlyOfficeUser;
  company: DocumentCompany | null;
}) {
  const { template, documentUrl, callbackUrl, user, company } = options;
  const documentServerUrl = getOnlyOfficeDocumentServerUrl();

  if (!documentServerUrl) {
    throw new Error(getOnlyOfficeMissingConfigReason() || "OnlyOffice nao configurado.");
  }

  const config: IConfig = {
    documentType: "word",
    height: "840px",
    width: "100%",
    type: "desktop",
    document: {
      fileType: "docx",
      key: buildOnlyOfficeDocumentKey(template),
      title: template.original_docx_filename || `${template.name}.docx`,
      url: documentUrl,
      permissions: {
        edit: true,
        download: true,
        print: true,
        copy: true,
        comment: false,
        review: true,
      },
    },
    editorConfig: {
      callbackUrl,
      mode: "edit",
      lang: "pt-BR",
      region: "pt-BR",
      user,
      customization: {
        autosave: true,
        forcesave: true,
        compactHeader: true,
        compactToolbar: false,
        comments: false,
        help: false,
        plugins: false,
        toolbarHideFileName: false,
        uiTheme: "theme-light",
        customer: {
          name: buildCompanyDisplayName(company),
        },
      },
    },
  };

  const configSecret = getOnlyOfficeConfigSecret();

  if (configSecret) {
    config.token = jwt.sign(config, configSecret, {
      algorithm: "HS256",
      expiresIn: "12h",
    });
  }

  return {
    documentServerUrl,
    config,
  };
}

export type { OnlyOfficeCallbackPayload };
