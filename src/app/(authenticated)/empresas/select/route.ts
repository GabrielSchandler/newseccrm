import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  ACTIVE_COMPANY_COOKIE_NAME,
  getHomeForRole,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/workspace";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectTo(request: NextRequest, pathname: string, error?: string) {
  const url = new URL(pathname, request.url);

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { supabase, role, businessArea, isPlatformOwner } =
    await getCurrentUserContext();

  if (!isPlatformOwner) {
    return redirectTo(request, getHomeForRole(role, businessArea));
  }

  const companyId = request.nextUrl.searchParams.get("company") ?? "";

  if (!uuidPattern.test(companyId)) {
    return redirectTo(request, "/empresas", "empresa_indisponivel");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (!company?.id) {
    return redirectTo(request, "/empresas", "empresa_indisponivel");
  }

  const response = redirectTo(request, "/areas");

  response.cookies.set(ACTIVE_COMPANY_COOKIE_NAME, company.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.delete(WORKSPACE_COOKIE_NAME);

  return response;
}
