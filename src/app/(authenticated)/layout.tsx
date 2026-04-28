import { redirect } from "next/navigation";
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
    <div className="min-h-screen bg-slate-100 md:flex">
      <div className="md:sticky md:top-0 md:h-screen">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          Versao {packageJson.version}
        </footer>
      </div>
    </div>
  );
}
