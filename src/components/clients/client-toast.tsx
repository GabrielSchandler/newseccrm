"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

type ClientToastProps = {
  message: string;
};

export function ClientToast({ message }: ClientToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="ns-card fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--ns-text)] shadow-lg">
      <CheckCircle2 className="h-5 w-5 text-[var(--ns-success)]" />
      {message}
    </div>
  );
}
