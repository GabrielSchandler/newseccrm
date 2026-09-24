type StatusMessageProps = {
  type?: "success" | "error";
  children: React.ReactNode;
};

export function StatusMessage({ type = "success", children }: StatusMessageProps) {
  const className =
    type === "success"
      ? "border-[var(--ns-success)]/30 bg-[var(--ns-success)]/10 text-[var(--ns-success)]"
      : "border-[var(--ns-danger)]/30 bg-[var(--ns-danger)]/10 text-[var(--ns-danger)]";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}
