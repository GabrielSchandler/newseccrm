import { NextResponse } from "next/server";
import {
  isAllowedFullRestoreBucket,
  type FullRestoreBucket,
} from "@/lib/backups/full-restore";
import { safeBackupPath } from "@/lib/backups/client-restore";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RestoreUploadRequest = {
  files?: Array<{
    bucket?: string;
    targetPath?: string;
    originalPath?: string;
    zipPath?: string;
  }>;
};

async function getAdminProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }),
      profile: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, company_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Perfil do usuario nao encontrado." },
        { status: 403 },
      ),
      profile: null,
    };
  }

  if (profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Apenas administradores podem restaurar backups." },
        { status: 403 },
      ),
      profile: null,
    };
  }

  return {
    error: null,
    profile: {
      id: profile.id as string,
      companyId: profile.company_id as string,
    },
  };
}

export async function POST(request: Request) {
  const { error, profile } = await getAdminProfile();

  if (error || !profile) {
    return error;
  }

  const body = (await request.json()) as RestoreUploadRequest;
  const files = body.files ?? [];

  if (!files.length) {
    return NextResponse.json({ uploads: [] });
  }

  if (files.length > 5000) {
    return NextResponse.json(
      { error: "Restaure no maximo 5000 arquivos por vez." },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const uploads: Array<{
    index: number;
    bucket: FullRestoreBucket;
    path: string;
    token: string;
    originalPath: string | null;
    zipPath: string | null;
  }> = [];

  for (const [index, file] of files.entries()) {
    const bucket = String(file.bucket ?? "");
    const targetPath = safeBackupPath(String(file.targetPath ?? ""));

    if (!isAllowedFullRestoreBucket(bucket) || !targetPath) {
      return NextResponse.json(
        { error: `Arquivo ${index + 1} possui bucket ou caminho invalido.` },
        { status: 400 },
      );
    }

    if (!targetPath.startsWith(`${profile.companyId}/`)) {
      return NextResponse.json(
        {
          error: `Arquivo ${index + 1} nao pertence ao caminho da empresa atual.`,
        },
        { status: 400 },
      );
    }

    const { data, error: uploadError } = await adminClient.storage
      .from(bucket)
      .createSignedUploadUrl(targetPath, { upsert: true });

    if (uploadError || !data?.token) {
      return NextResponse.json(
        {
          error:
            uploadError?.message ??
            `Nao foi possivel preparar o upload do arquivo ${index + 1}.`,
        },
        { status: 500 },
      );
    }

    uploads.push({
      index,
      bucket,
      path: targetPath,
      token: data.token,
      originalPath: file.originalPath ?? null,
      zipPath: file.zipPath ?? null,
    });
  }

  return NextResponse.json({ uploads });
}
