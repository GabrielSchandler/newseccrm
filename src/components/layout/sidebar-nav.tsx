"use client";

import {
  BarChart3,
  Calculator,
  FileSignature,
  FileText,
  Handshake,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    | "users";
  managerOnly?: boolean;
};

type SidebarNavProps = {
  items: SidebarNavigationItem[];
  canManageTemplates: boolean;
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
};

function isActivePath(pathname: string, href: string) {
  if (href === "/documentos") {
    return pathname === href || pathname.startsWith("/documentos/gerados");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, canManageTemplates }: SidebarNavProps) {
  const pathname = usePathname();

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
            className={`inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
              active
                ? "bg-teal-50 text-teal-900"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`h-4 w-4 ${active ? "text-teal-800" : "text-teal-700"}`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
