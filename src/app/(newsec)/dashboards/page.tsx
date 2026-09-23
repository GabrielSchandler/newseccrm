import type { Metadata } from "next";
import { TopBar } from "@/components/newsec/top-bar";
import { DashboardsWorkspace } from "@/components/newsec/dashboards-workspace";

export const metadata: Metadata = {
  title: "Dashboards · NewSec (demonstração)",
};

export default function DashboardsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName="Empresa de demonstração" />
      <DashboardsWorkspace />
    </div>
  );
}
