import {
  BarChart3,
  FileText,
  FileSignature,
  Handshake,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/current-user";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pre-vendas", label: "Pre-vendas", icon: Handshake },
  { href: "/documentos", label: "Documentos", icon: FileText },
  {
    href: "/documentos/templates",
    label: "Templates",
    icon: FileText,
    managerOnly: true,
  },
  { href: "/contratos", label: "Contratos", icon: FileSignature },
  { href: "/usuarios", label: "Usuarios", icon: BarChart3 },
];

export async function AppSidebar() {
  const { role } = await getCurrentUserContext();
  const canManageTemplates = role === "admin" || role === "manager";

  return (
    <aside className="flex min-h-screen w-full flex-col border-r border-slate-200 bg-white px-4 py-5 md:w-72">
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          CRM SaaS
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950">
          Painel multiempresa
        </h1>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {navigation.map((item) => {
          if ("managerOnly" in item && item.managerOnly && !canManageTemplates) {
            return null;
          }

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <Icon className="h-4 w-4 text-teal-700" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </form>
    </aside>
  );
}
