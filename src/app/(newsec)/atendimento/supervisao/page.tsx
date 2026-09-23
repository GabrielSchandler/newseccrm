import type { Metadata } from "next";
import { TopBar } from "@/components/newsec/top-bar";
import { SupervisaoWorkspace } from "@/components/newsec/supervisao-workspace";

export const metadata: Metadata = {
  title: "Supervisão · NewSec (demonstração)",
};

export default function SupervisaoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName="Empresa de demonstração" links={[{ href: "/atendimento", label: "← Atendimento" }]} />
      <SupervisaoWorkspace />
    </div>
  );
}
