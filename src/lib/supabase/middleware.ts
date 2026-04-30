import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const protectedRoutes = [
  "/dashboard",
  "/clientes",
  "/pre-vendas",
  "/calculos",
  "/documentos",
  "/contratos",
  "/empresa",
  "/logs",
  "/usuarios",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  let profileRole: string | null = null;

  if (user && (isLoginRoute || isDashboardRoute)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    profileRole = (profile as { role?: string | null } | null)?.role ?? null;
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = profileRole === "seller" ? "/pre-vendas" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isDashboardRoute && profileRole === "seller") {
    const url = request.nextUrl.clone();
    url.pathname = "/pre-vendas";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
