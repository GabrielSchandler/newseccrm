import { NextResponse, type NextRequest } from "next/server";
import { generateStoredBackup } from "@/lib/backups/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCron(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: companies, error } = await adminClient
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const company of companies ?? []) {
    try {
      const backup = await generateStoredBackup({
        companyId: (company as { id: string }).id,
        requestedBy: null,
        triggerType: "scheduled",
      });

      results.push({
        company_id: (company as { id: string }).id,
        status: "completed",
        backup,
      });
    } catch (backupError) {
      results.push({
        company_id: (company as { id: string }).id,
        status: "failed",
        error:
          backupError instanceof Error
            ? backupError.message
            : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({
    ok: results.every((item) => item.status === "completed"),
    results,
  });
}
