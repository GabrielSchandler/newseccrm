type StatusMessageProps = {
  type?: "success" | "error";
  children: React.ReactNode;
};

export function StatusMessage({ type = "success", children }: StatusMessageProps) {
  const className =
    type === "success"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}
