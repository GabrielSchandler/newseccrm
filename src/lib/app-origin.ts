import { headers } from "next/headers";

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export async function getAppOrigin() {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (explicitUrl) {
    const normalized = explicitUrl.startsWith("http")
      ? explicitUrl
      : `https://${explicitUrl}`;

    return normalizeUrl(normalized);
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto =
    requestHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}
