import { NextResponse } from "next/server";
import { generateStoredBackup } from "@/lib/backups/jobs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Perfil do usuario nao encontrado." },
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
      { error: "Usuario sem empresa vinculada para gerar backup." },
      { status: 400 },
    );
  }

  try {
    const backup = await generateStoredBackup({
      companyId,
      requestedBy: profile.id as string,
      triggerType: "manual",
    });

    return NextResponse.json({ backup });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel gerar o backup.",
      },
      { status: 500 },
    );
  }
}
