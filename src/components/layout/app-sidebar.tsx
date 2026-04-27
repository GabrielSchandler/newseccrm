import {
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { SidebarNav, type SidebarNavigationItem } from "./sidebar-nav";

const navigation: SidebarNavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/clientes", label: "Clientes", icon: "clients" },
  { href: "/pre-vendas", label: "Pre-vendas", icon: "preSales" },
  { href: "/documentos", label: "Documentos", icon: "documents" },
  {
    href: "/documentos/templates",
    label: "Templates",
    icon: "templates",
    managerOnly: true,
  },
  { href: "/contratos", label: "Contratos", icon: "contracts" },
  { href: "/usuarios", label: "Usuarios", icon: "users" },
];

export async function AppSidebar() {
  const { role } = await getCurrentUserContext();
  const canManageTemplates = role === "admin" || role === "manager";
  const canAccessUsers = role === "admin" || role === "manager";
  const canAccessDashboard = role !== "seller";
  const visibleNavigation = navigation.filter(
    (item) =>
      (item.href !== "/usuarios" || canAccessUsers) &&
      (item.href !== "/dashboard" || canAccessDashboard),
  );

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
            <span>
              <span className="block text-xs uppercase tracking-wide text-teal-700">
                CRM SaaS
              </span>
              Painel multiempresa
            </span>
            <span className="text-xs text-slate-500 group-open:hidden">Menu</span>
            <span className="hidden text-xs text-slate-500 group-open:inline">
              Fechar
            </span>
          </summary>
          <div className="mt-3 space-y-3 pb-2">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            CRM SaaS
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            Painel multiempresa
          </h1>
        </div>

        <div className="mt-8 flex flex-1">
          <SidebarNav
            items={visibleNavigation}
            canManageTemplates={canManageTemplates}
          />
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
