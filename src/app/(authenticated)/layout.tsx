import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import packageJson from "../../../package.json";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
