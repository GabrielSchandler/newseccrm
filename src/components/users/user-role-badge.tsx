import { formatCompanyUserRole, type CompanyUserRole } from "@/types/user";

type UserRoleBadgeProps = {
  role: CompanyUserRole | string | null;
};

const roleStyles: Record<CompanyUserRole, string> = {
  admin: "bg-red-50 text-red-700",
  manager: "bg-amber-50 text-amber-700",
  seller: "bg-sky-50 text-sky-700",
};

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const normalizedRole = role === "admin" || role === "manager" || role === "seller"
    ? role
    : null;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        normalizedRole ? roleStyles[normalizedRole] : "bg-slate-100 text-slate-600"
      }`}
    >
      {formatCompanyUserRole(role)}
    </span>
  );
}
