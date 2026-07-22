import { NextResponse } from "next/server";
import {
  prepareBackupData,
  signStorageRefs,
} from "@/lib/backups/export";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Perfil do usuário não encontrado." },
      { status: 403 },
    );
  }

  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem gerar backup." },
      { status: 403 },
    );
  }

  const companyId = profile.company_id as string | null;

  if (!companyId) {
    return NextResponse.json(
      { error: "Usuário sem empresa vinculada para gerar backup." },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const preparedBackup = await prepareBackupData({
    adminClient,
    companyId,
    generatedBy: profile.id as string,
  });
  const files = await signStorageRefs({
    adminClient,
    backupRoot: preparedBackup.backup_root,
    refs: preparedBackup.storage_refs,
  });

  return NextResponse.json(
    {
      generated_at: preparedBackup.generated_at,
      backup_name: preparedBackup.backup_name,
      backup_root: preparedBackup.backup_root,
      company_id: preparedBackup.company_id,
      generated_by: preparedBackup.generated_by,
      signed_url_expires_in_seconds:
        preparedBackup.signed_url_expires_in_seconds,
      tables: preparedBackup.tables.map((item) => ({
        table: item.table,
        rows: item.rows,
        error: item.error,
      })),
      files,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
