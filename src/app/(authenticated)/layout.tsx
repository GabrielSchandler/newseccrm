import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import packageJson from "../../../package.json";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await getCurrentUserContext();

  return (
    <AuthenticatedShell
      sidebar={<AppSidebar />}
      footer={
        <div className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          Versao {packageJson.version}
        </div>
      }
    >
      {children}
    </AuthenticatedShell>
  );
}
