import type { CompanyUserRole } from "@/types/user";

export const WORKSPACE_COOKIE_NAME = "grscrm-workspace";

export type CompanyBusinessArea = "commercial" | "legal";
export type WorkspaceView = "management" | "finance" | CompanyBusinessArea;

export const businessAreaOptions: Array<{
  value: CompanyBusinessArea;
  label: string;
  description: string;
}> = [
  {
    value: "commercial",
    label: "Comercial",
    description: "Pre-vendas, clientes, simulacoes, documentos e contratos.",
  },
  {
    value: "legal",
    label: "Juridico",
    description: "Clientes, pre-vendas e documentos da frente juridica da empresa.",
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
    label: "Gestao",
    description: "Dashboard, usuarios, empresa, templates, contratos e configuracoes.",
    href: "/dashboard",
  },
  {
    value: "commercial",
    label: "Comercial",
    description: "Clientes, pre-vendas, simulacoes e documentos da operacao comercial.",
    href: "/comercial",
  },
  {
    value: "legal",
    label: "Juridico",
    description: "Clientes, pre-vendas e documentos gerados da operacao juridica.",
    href: "/juridico",
  },
  {
    value: "finance",
    label: "Financeiro",
    description: "Controle financeiro, importacao de planilhas e resultados por periodo.",
    href: "/financeiro",
  },
];

export function normalizeBusinessArea(value: string | null | undefined): CompanyBusinessArea {
  return value === "legal" ? "legal" : "commercial";
}

export function normalizeWorkspaceView(value: string | null | undefined): WorkspaceView {
  if (value === "management" || value === "legal" || value === "finance") {
    return value;
  }

  return "commercial";
}

export function getSellerHome(area: CompanyBusinessArea) {
  return area === "legal" ? "/juridico" : "/comercial";
}

export function getHomeForRole(role: CompanyUserRole | string | null, area: CompanyBusinessArea) {
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
  return normalizeBusinessArea(area) === "legal" ? "Juridico" : "Comercial";
}

const managementPrefixes = [
  "/dashboard",
  "/usuarios",
  "/empresa",
  "/backups",
  "/logs",
  "/contratos",
  "/documentos/templates",
  "/emails/templates",
  "/areas",
];

const financePrefixes = ["/financeiro"];

const legalPrefixes = ["/juridico"];

const commercialPrefixes = ["/comercial", "/calculos"];

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

  if (commercialPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return "commercial";
  }

  return null;
}

export function isSharedOperationalPath(pathname: string) {
  return sharedOperationalPrefixes.some((prefix) => pathname.startsWith(prefix));
}
