import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicTrackingRateLimitStatus =
  | "allowed"
  | "blocked"
  | "unavailable";

function getRateLimitSecret() {
  return (
    process.env.PUBLIC_TRACKING_RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

function hashRateLimitKey(value: string) {
  const secret = getRateLimitSecret();

  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

async function consumeBucket(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
) {
  const keyHash = hashRateLimitKey(key);

  if (!keyHash) {
    return "unavailable" as const;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc(
    "consume_public_tracking_rate_limit",
    {
      p_key_hash: keyHash,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    },
  );

  if (error) {
    console.error("Public tracking rate limiter is unavailable.", {
      code: error.code,
    });
    return "unavailable" as const;
  }

  return data === true ? ("allowed" as const) : ("blocked" as const);
}

export async function checkPublicTrackingRateLimit(
  normalizedCpf: string,
): Promise<PublicTrackingRateLimitStatus> {
  const requestHeaders = await headers();
  const forwardedFor =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  const clientAddress = forwardedFor.split(",")[0]?.trim() || "unknown";
  const windowSeconds = 15 * 60;

  const [addressBucket, addressAndCpfBucket] = await Promise.all([
    consumeBucket(`tracking:address:${clientAddress}`, 30, windowSeconds),
    consumeBucket(
      `tracking:address-cpf:${clientAddress}:${normalizedCpf}`,
      10,
      windowSeconds,
    ),
  ]);

  if (addressBucket === "unavailable" || addressAndCpfBucket === "unavailable") {
    return "unavailable";
  }

  if (addressBucket === "blocked" || addressAndCpfBucket === "blocked") {
    return "blocked";
  }

  return "allowed";
}
