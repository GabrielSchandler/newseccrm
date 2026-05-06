import Link from "next/link";
import {
  House,
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
import { SidebarNav, type SidebarNavigationItem } from "./sidebar-nav";

const navigation: SidebarNavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
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
  { href: "/contratos", label: "Contratos", icon: "contracts" },
  { href: "/usuarios", label: "Usuarios", icon: "users" },
  { href: "/empresa", label: "Empresa", icon: "company", adminOnly: true },
  { href: "/logs", label: "Logs", icon: "logs", adminOnly: true },
  { href: "/juridico", label: "Juridico", icon: "legal" },
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
  const canManageTemplates = role === "admin" || role === "manager";
  const canAccessUsers = role === "admin" || role === "manager";
  const canAccessDashboard = role !== "seller";
  const canAccessAdminOnly = role === "admin";
  const homeHref = getHomeForRole(role, businessArea);
  const currentWorkspace = resolveCurrentWorkspace(
    role,
    businessArea,
    cookieStore.get(WORKSPACE_COOKIE_NAME)?.value ?? null,
  );
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

  const visibleNavigation = navigation.filter(
    (item) =>
      (!item.adminOnly || canAccessAdminOnly) &&
      (item.href !== "/usuarios" || canAccessUsers) &&
      (item.href !== "/dashboard" || canAccessDashboard) &&
      ((currentWorkspace === "management" &&
        [
          "/dashboard",
          "/documentos",
          "/documentos/templates",
          "/contratos",
          "/usuarios",
          "/empresa",
          "/logs",
        ].includes(item.href)) ||
        (currentWorkspace === "commercial" &&
          ["/clientes", "/pre-vendas", "/calculos"].includes(item.href)) ||
        (currentWorkspace === "legal" && item.href === "/juridico")),
  );

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
            <span className="flex min-w-0 items-center gap-3">
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt={`Logo da empresa ${companyName}`}
                  className="h-10 w-10 rounded-md object-contain"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 px-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  {companyName.slice(0, 2)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-wide text-teal-700">
                  {currentWorkspace === "management"
                    ? "Gestao"
                    : currentWorkspace === "legal"
                      ? "Juridico"
                      : "Comercial"}
                </span>
                <span className="block truncate">{companyName}</span>
              </span>
            </span>
            <span className="text-xs text-slate-500 group-open:hidden">Menu</span>
            <span className="hidden text-xs text-slate-500 group-open:inline">
              Fechar
            </span>
          </summary>
          <div className="mt-3 space-y-3 pb-2">
            <Link
              href={homeHref}
              className="inline-flex w-full items-center gap-3 rounded-lg bg-teal-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <House aria-hidden="true" className="h-4 w-4" />
              Tela inicial
            </Link>
            <SidebarNav
              items={visibleNavigation}
              canManageTemplates={canManageTemplates}
            />
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </details>
      </div>

      <aside className="hidden min-h-screen w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <div className="px-2">
          <div className="flex items-center gap-3">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={`Logo da empresa ${companyName}`}
                className="h-14 w-14 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 px-2 text-center text-sm font-bold uppercase tracking-wide text-slate-700">
                {companyName.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {currentWorkspace === "management"
                  ? "Gestao"
                  : currentWorkspace === "legal"
                    ? "Juridico"
                    : "Comercial"}
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-slate-950">
                {companyName}
              </h1>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-1">
          <div className="flex flex-1 flex-col gap-4">
            <div className="px-2">
              <Link
                href={homeHref}
                className="inline-flex w-full items-center gap-3 rounded-lg bg-teal-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <House aria-hidden="true" className="h-4 w-4" />
                Tela inicial
              </Link>
            </div>
            <SidebarNav
              items={visibleNavigation}
              canManageTemplates={canManageTemplates}
            />
          </div>
        </div>

        <div className="px-3 pb-3 text-xs text-slate-400">
          Versao {packageJson.version}
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </button>
        </form>
      </aside>
    </>
  );
}
