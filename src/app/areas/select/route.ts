import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getWorkspaceHref,
  normalizeWorkspaceView,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const workspace = normalizeWorkspaceView(
    request.nextUrl.searchParams.get("workspace"),
  );
  const response = NextResponse.redirect(
    new URL(getWorkspaceHref(workspace), request.url),
  );

  response.cookies.set(WORKSPACE_COOKIE_NAME, workspace, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
