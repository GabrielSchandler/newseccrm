import type { Metadata } from "next";
import { TopBar } from "@/components/newsec/top-bar";
import { ProdutividadeWorkspace } from "@/components/newsec/produtividade-workspace";

export const metadata: Metadata = {
  title: "Produtividade · NewSec (demonstração)",
};

export default function ProdutividadePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar companyName="Empresa de demonstração" />
      <ProdutividadeWorkspace />
    </div>
  );
}
