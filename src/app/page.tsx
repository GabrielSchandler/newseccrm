import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getHomeForRole } from "@/lib/workspace";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { role, businessArea } = await getCurrentUserContext();

  redirect(getHomeForRole(role, businessArea));
}
