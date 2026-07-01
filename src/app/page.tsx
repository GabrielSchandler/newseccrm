import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getHomeForRole } from "@/lib/workspace";

export default async function HomePage() {
  const { role, businessArea, isPlatformOwner } = await getCurrentUserContext();

  return redirect(getHomeForRole(role, businessArea, isPlatformOwner));
}
