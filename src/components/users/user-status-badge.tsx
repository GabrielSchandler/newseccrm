type UserStatusBadgeProps = {
  isActive: boolean;
};

export function UserStatusBadge({ isActive }: UserStatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}
