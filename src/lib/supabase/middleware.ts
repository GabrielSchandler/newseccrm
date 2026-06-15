import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import {
  classifyWorkspacePath,
  getHomeForRole,
  isSharedOperationalPath,
  normalizeBusinessArea,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/workspace";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const protectedRoutes = [
  "/dashboard",
  "/clientes",
  "/comercial",
  "/pre-vendas",
  "/calculos",
  "/documentos",
  "/contratos",
  "/empresa",
  "/logs",
  "/usuarios",
  "/areas",
  "/juridico",
  "/alterar-senha",
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
  const isPasswordChangeRoute = request.nextUrl.pathname === "/alterar-senha";
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isPublicTrackingRoute = request.nextUrl.pathname.startsWith("/acompanhamento");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  let profileRole: string | null = null;
  let profileBusinessArea: string | null = null;
  let profilePasswordMustChange = false;

  if (user && (isLoginRoute || isDashboardRoute || isProtectedRoute)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, business_area, password_must_change")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    profileRole = (profile as { role?: string | null } | null)?.role ?? null;
    profileBusinessArea =
      (profile as { business_area?: string | null } | null)?.business_area ?? null;
    profilePasswordMustChange = Boolean(
      (profile as { password_must_change?: boolean | null } | null)
        ?.password_must_change,
    );
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = profilePasswordMustChange
      ? "/alterar-senha"
      : getHomeForRole(
          profileRole,
          normalizeBusinessArea(profileBusinessArea),
        );
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    profilePasswordMustChange &&
    isProtectedRoute &&
    !isPasswordChangeRoute
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/alterar-senha";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isPasswordChangeRoute && !profilePasswordMustChange) {
    const url = request.nextUrl.clone();
    url.pathname = getHomeForRole(
      profileRole,
      normalizeBusinessArea(profileBusinessArea),
    );
    url.search = "";
    return NextResponse.redirect(url);
  }

  const routeWorkspace = classifyWorkspacePath(request.nextUrl.pathname);

  if (user && routeWorkspace) {
    if (profileRole === null || profileBusinessArea === null) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, business_area")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      profileRole = (profile as { role?: string | null } | null)?.role ?? null;
      profileBusinessArea =
        (profile as { business_area?: string | null } | null)?.business_area ?? null;
    }
  }

  if (user && routeWorkspace && profileRole === "seller") {
    const sellerArea = normalizeBusinessArea(profileBusinessArea);

    if (routeWorkspace === "management" || routeWorkspace !== sellerArea) {
      const url = request.nextUrl.clone();
      url.pathname = getHomeForRole(profileRole, sellerArea);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (
    user &&
    !routeWorkspace &&
    profileRole === "seller" &&
    !isPasswordChangeRoute &&
    !isPublicTrackingRoute
  ) {
    const sellerArea = normalizeBusinessArea(profileBusinessArea);
    const isSharedPath = isSharedOperationalPath(request.nextUrl.pathname);

    if (!isSharedPath) {
      const url = request.nextUrl.clone();
      url.pathname = getHomeForRole(profileRole, sellerArea);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && isDashboardRoute && profileRole === "seller") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeForRole(
      profileRole,
      normalizeBusinessArea(profileBusinessArea),
    );
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/areas") {
    const cookieWorkspace = request.cookies.get(WORKSPACE_COOKIE_NAME)?.value ?? null;

    if (profileRole === "seller") {
      const url = request.nextUrl.clone();
      url.pathname = getHomeForRole(
        profileRole,
        normalizeBusinessArea(profileBusinessArea),
      );
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!cookieWorkspace && profileRole && profileRole !== "seller") {
      return supabaseResponse;
    }
  }

  if (user && routeWorkspace && profileRole && profileRole !== "seller") {
    supabaseResponse.cookies.set(WORKSPACE_COOKIE_NAME, routeWorkspace, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return supabaseResponse;
}
