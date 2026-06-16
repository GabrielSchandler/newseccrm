import {
  LogOut,
} from "lucide-react";
import { cookies } from "next/headers";
import packageJson from "../../../package.json";
import { signOut } from "@/app/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  getHomeForRole,
  resolveCurrentWorkspace,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/workspace";
import { SidebarFrame } from "./sidebar-frame";
import { type SidebarNavigationItem } from "./sidebar-nav";

const navigation: SidebarNavigationItem[] = [
  { href: "/dashboard", label: "Painel comercial", icon: "dashboard" },
  { href: "/comercial", label: "Painel comercial", icon: "dashboard" },
  { href: "/clientes", label: "Clientes", icon: "clients" },
  { href: "/pre-vendas", label: "Pre-vendas", icon: "preSales" },
  { href: "/calculos", label: "Simulacoes", icon: "calculations" },
  { href: "/documentos", label: "Documentos", icon: "documents" },
  {
    href: "/documentos/templates",
    label: "Templates",
    icon: "templates",
    managerOnly: true,
  },
  {
    href: "/emails/templates",
    label: "Templates de email",
    icon: "email",
    managerOnly: true,
  },
  { href: "/integracoes", label: "Integracoes", icon: "integrations" },
  { href: "/contratos", label: "Contratos", icon: "contracts" },
  { href: "/usuarios", label: "Usuarios", icon: "users" },
  { href: "/empresa", label: "Empresa", icon: "company", adminOnly: true },
  { href: "/backups", label: "Backups", icon: "backups", adminOnly: true },
  { href: "/logs", label: "Logs", icon: "logs", adminOnly: true },
  { href: "/juridico", label: "Esteira", icon: "legal" },
];

function resolveCompanyDisplayName(company: {
  trade_name?: string | null;
  legal_name?: string | null;
} | null) {
  return company?.trade_name?.trim() || company?.legal_name?.trim() || "CRM SaaS";
}

export async function AppSidebar() {
  const { role, supabase, companyId, businessArea } = await getCurrentUserContext();
  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value ?? null;
  const canManageTemplates = role === "admin" || role === "manager";
  const canAccessUsers = role === "admin" || role === "manager";
  const canAccessDashboard = role !== "seller";
  const canAccessAdminOnly = role === "admin";
  const homeHref = getHomeForRole(role, businessArea);
  const resolvedWorkspace = resolveCurrentWorkspace(role, businessArea, workspaceCookie);
  const { data: companyData } = await supabase
    .from("companies")
    .select("trade_name, legal_name, logo_path")
    .eq("id", companyId)
    .maybeSingle();
  const company = (companyData ?? null) as {
    trade_name?: string | null;
    legal_name?: string | null;
    logo_path?: string | null;
  } | null;
  const companyName = resolveCompanyDisplayName(company);
  let companyLogoUrl: string | null = null;

  if (company?.logo_path) {
    const { data: signedData } = await supabase.storage
      .from("documents")
      .createSignedUrl(company.logo_path, 60 * 10);

    companyLogoUrl = signedData?.signedUrl ?? null;
  }

  return (
    <SidebarFrame
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      canManageTemplates={canManageTemplates}
      canAccessUsers={canAccessUsers}
      canAccessDashboard={canAccessDashboard}
      canAccessAdminOnly={canAccessAdminOnly}
      homeHref={homeHref}
      resolvedWorkspace={resolvedWorkspace}
      footer={<>Versao {packageJson.version}</>}
      navigation={navigation}
      logoutNode={
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </button>
        </form>
      }
    />
  );
}
