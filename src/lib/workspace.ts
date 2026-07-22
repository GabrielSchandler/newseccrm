import type { CompanyUserRole } from "@/types/user";

export const WORKSPACE_COOKIE_NAME = "grscrm-workspace";
export const ACTIVE_COMPANY_COOKIE_NAME = "grscrm-active-company";

export type CompanyBusinessArea = "commercial" | "legal";
export type WorkspaceView = "management" | "finance" | "academy" | CompanyBusinessArea;

export const businessAreaOptions: Array<{
  value: CompanyBusinessArea;
  label: string;
  description: string;
}> = [
  {
    value: "commercial",
    label: "Comercial",
    description: "Pré-vendas, clientes, simulações, documentos e contratos.",
  },
  {
    value: "legal",
    label: "Jurídico",
    description: "Clientes, pré-vendas e documentos da frente jurídica da empresa.",
  },
];

export const workspaceOptions: Array<{
  value: WorkspaceView;
  label: string;
  description: string;
  href: string;
}> = [
  {
    value: "management",
    label: "Gestão",
    description: "Dashboard, usuários, empresa, templates, contratos e configurações.",
    href: "/dashboard",
  },
  {
    value: "commercial",
    label: "Comercial",
    description: "Clientes, pré-vendas, simulações e documentos da operação comercial.",
    href: "/comercial",
  },
  {
    value: "legal",
    label: "Jurídico",
    description: "Clientes, pré-vendas e documentos gerados da operação jurídica.",
    href: "/juridico",
  },
  {
    value: "finance",
    label: "Financeiro",
    description: "Controle financeiro, importação de planilhas e resultados por período.",
    href: "/financeiro",
  },
];

export function normalizeBusinessArea(value: string | null | undefined): CompanyBusinessArea {
  return value === "legal" ? "legal" : "commercial";
}

export function normalizeWorkspaceView(value: string | null | undefined): WorkspaceView {
  if (
    value === "management" ||
    value === "legal" ||
    value === "finance" ||
    value === "academy"
  ) {
    return value;
  }

  return "commercial";
}

export function getSellerHome(area: CompanyBusinessArea) {
  return area === "legal" ? "/juridico" : "/comercial";
}

export function getHomeForRole(
  role: CompanyUserRole | string | null,
  area: CompanyBusinessArea,
  isPlatformOwner = false,
) {
  if (isPlatformOwner) {
    return "/empresas";
  }

  return role === "seller" ? getSellerHome(area) : "/areas";
}

export function getWorkspaceHref(workspace: WorkspaceView) {
  return workspaceOptions.find((item) => item.value === workspace)?.href ?? "/areas";
}

export function resolveCurrentWorkspace(
  role: CompanyUserRole | string | null,
  area: CompanyBusinessArea,
  cookieValue: string | null | undefined,
): WorkspaceView {
  if (role === "seller") {
    return area;
  }

  if (!cookieValue) {
    return "management";
  }

  return normalizeWorkspaceView(cookieValue);
}

export function formatBusinessAreaLabel(area: CompanyBusinessArea | string | null | undefined) {
  return normalizeBusinessArea(area) === "legal" ? "Jurídico" : "Comercial";
}

const managementPrefixes = [
  "/dashboard",
  "/usuarios",
  "/empresa",
  "/backups",
  "/empresas",
  "/logs",
  "/contratos",
  "/integracoes",
  "/documentos/templates",
  "/emails/templates",
  "/academy/gestao",
  "/areas",
];

const financePrefixes = ["/financeiro"];

const academyPrefixes = ["/academy"];

const legalPrefixes = ["/juridico"];

const commercialPrefixes = ["/comercial", "/calculos", "/leads"];

const sharedOperationalPrefixes = ["/clientes", "/pre-vendas", "/documentos"];

export function classifyWorkspacePath(pathname: string): WorkspaceView | null {
  if (financePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "finance";
  }

  if (managementPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "management";
  }

  if (legalPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "legal";
  }

  if (academyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "academy";
  }

  if (commercialPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "commercial";
  }

  return null;
}

export function isSharedOperationalPath(pathname: string) {
  return sharedOperationalPrefixes.some((prefix) => pathname.startsWith(prefix));
}
