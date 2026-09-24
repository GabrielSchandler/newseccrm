import { MessageCircle } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/clients/masks";

type WhatsAppLinkProps = {
  phone: string | null;
  label?: string;
  className?: string;
};

export function WhatsAppLink({ phone, label = "WhatsApp", className }: WhatsAppLinkProps) {
  const href = getWhatsAppUrl(phone);

  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-[var(--ns-primary)]/30 bg-[var(--ns-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--ns-primary)] transition hover:bg-[var(--ns-primary)]/10"
      }
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );
}
