import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit/log";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { persistMicrosoftIntegration } from "@/lib/email/integrations";
import { exchangeMicrosoftCode } from "@/lib/email/microsoft";

export const runtime = "nodejs";

const outlookOAuthStateCookie = "grscrm_outlook_oauth_state";

function redirectToIntegrations(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/integracoes", request.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectToIntegrations(request, { error: "outlook_denied" });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(outlookOAuthStateCookie)?.value;

  if (!state || !expectedState || state !== expectedState) {
    return redirectToIntegrations(request, { error: "invalid_state" });
  }

  cookieStore.delete(outlookOAuthStateCookie);

  if (!code) {
    return redirectToIntegrations(request, { error: "missing_code" });
  }

  try {
    const { supabase, companyId, userProfileId } = await getCurrentUserContext();
    const token = await exchangeMicrosoftCode(code);

    if (!token.refresh_token) {
      throw new Error("A Microsoft não retornou refresh token. Verifique a permissão offline_access.");
    }

    const integration = await persistMicrosoftIntegration({
      companyId,
      userProfileId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      scope: token.scope,
    });

    await recordAuditLog({
      supabase,
      companyId,
      userProfileId,
      action: "email.outlook_connected",
      entityType: "email_integration",
      entityId: userProfileId,
      entityLabel: integration.email,
      details: {
        email: integration.email,
      },
    });
  } catch (connectionError) {
    console.error("[email] outlook callback failed", connectionError);
    return redirectToIntegrations(request, { error: "connect_failed" });
  }

  return redirectToIntegrations(request, { outlook: "connected" });
}
