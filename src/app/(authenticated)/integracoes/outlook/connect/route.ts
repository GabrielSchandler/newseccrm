import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { buildMicrosoftAuthorizeUrl } from "@/lib/email/microsoft";

const outlookOAuthStateCookie = "grscrm_outlook_oauth_state";

function canConnectOutlook(role: string | null, businessArea: string, legalRole: string | null) {
  return role === "admin" || role === "manager" || (businessArea === "legal" && legalRole === "admin");
}

export async function GET(request: Request) {
  const { role, businessArea, legalRole } = await getCurrentUserContext();

  if (!canConnectOutlook(role, businessArea, legalRole)) {
    return NextResponse.redirect(new URL("/integracoes?error=permission", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(outlookOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(buildMicrosoftAuthorizeUrl(state));
}
