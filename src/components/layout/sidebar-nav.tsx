"use client";

import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  FileSignature,
  FileText,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Mail,
  WalletCards,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_COOKIE_NAME, type WorkspaceView } from "@/lib/workspace";

export type SidebarNavigationItem = {
  href: string;
  label: string;
  icon:
    | "dashboard"
    | "clients"
    | "preSales"
    | "calculations"
    | "documents"
    | "templates"
    | "contracts"
    | "users"
    | "company"
    | "backups"
    | "logs"
    | "email"
    | "integrations"
    | "leads"
    | "legal"
    | "finance"
    | "academy";
  managerOnly?: boolean;
  adminOnly?: boolean;
};

type SidebarNavProps = {
  items: SidebarNavigationItem[];
  canManageTemplates: boolean;
  workspace: WorkspaceView;
};

const icons = {
  dashboard: LayoutDashboard,
  clients: Users,
  preSales: Handshake,
  calculations: Calculator,
  documents: FileText,
  templates: FileText,
  contracts: FileSignature,
  users: BarChart3,
  company: Building2,
  backups: ClipboardList,
  logs: ClipboardList,
  email: Mail,
  integrations: Mail,
  leads: ClipboardList,
  legal: FileText,
  finance: WalletCards,
  academy: GraduationCap,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/documentos") {
    return pathname === href || pathname.startsWith("/documentos/gerados");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  items,
  canManageTemplates,
  workspace,
}: SidebarNavProps) {
  const pathname = usePathname();

  function persistWorkspacePreference() {
    document.cookie = `${WORKSPACE_COOKIE_NAME}=${workspace}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        if (item.managerOnly && !canManageTemplates) {
          return null;
        }

        const Icon = icons[item.icon];
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={persistWorkspacePreference}
            className={`group inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
              active
                ? "bg-teal-50 text-teal-950 shadow-[inset_3px_0_0_#0f766e]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`h-4 w-4 transition ${
                active ? "text-teal-800" : "text-slate-500 group-hover:text-teal-700"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
