import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { buildMicrosoftAuthorizeUrl } from "@/lib/email/microsoft";

export const runtime = "nodejs";

const outlookOAuthStateCookie = "grscrm_outlook_oauth_state";

function canConnectOutlook(role: string | null, businessArea: string, legalRole: string | null) {
  return role === "admin" || role === "manager" || (businessArea === "legal" && legalRole === "admin");
}

function redirectToIntegrations(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/integracoes?error=${error}`, request.url));
}

export async function GET(request: Request) {
  const { role, businessArea, legalRole } = await getCurrentUserContext();

  if (!canConnectOutlook(role, businessArea, legalRole)) {
    return redirectToIntegrations(request, "permission");
  }

  const state = randomBytes(24).toString("hex");
  let authorizeUrl: string;

  try {
    authorizeUrl = buildMicrosoftAuthorizeUrl(state);
  } catch (error) {
    console.error("[email] outlook connect failed", error);
    return redirectToIntegrations(request, "outlook_config");
  }

  const cookieStore = await cookies();
  cookieStore.set(outlookOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
