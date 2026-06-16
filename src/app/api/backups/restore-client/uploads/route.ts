import { NextResponse } from "next/server";
import {
  clientRestoreAllowedBuckets,
  safeBackupPath,
  type ClientRestoreBucket,
} from "@/lib/backups/client-restore";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type RestoreUploadRequest = {
  files?: Array<{
    bucket?: string;
    targetPath?: string;
    originalPath?: string;
    zipPath?: string;
  }>;
};

function isAllowedBucket(bucket: string): bucket is ClientRestoreBucket {
  return (clientRestoreAllowedBuckets as readonly string[]).includes(bucket);
}

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

  if (files.length > 300) {
    return NextResponse.json(
      { error: "Restaure no maximo 300 arquivos por vez." },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const uploads = [];

  for (const [index, file] of files.entries()) {
    const bucket = String(file.bucket ?? "");
    const targetPath = safeBackupPath(String(file.targetPath ?? ""));

    if (!isAllowedBucket(bucket) || !targetPath) {
      return NextResponse.json(
        { error: `Arquivo ${index + 1} possui bucket ou caminho invalido.` },
        { status: 400 },
      );
    }

    if (!targetPath.startsWith(`restores/${profile.companyId}/`)) {
      return NextResponse.json(
        { error: `Arquivo ${index + 1} nao esta no caminho seguro de restauracao.` },
        { status: 400 },
      );
    }

    const { data, error: uploadError } = await adminClient.storage
      .from(bucket)
      .createSignedUploadUrl(targetPath);

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
