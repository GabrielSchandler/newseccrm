import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel ${name} e obrigatoria.`);
  }

  return value;
}

function getExpirationDate() {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 7);
  return expiration.toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const metadataFile = args["metadata-file"];
  const externalUrl = args["external-url"];

  if (typeof metadataFile !== "string" || typeof externalUrl !== "string") {
    throw new Error("Informe --metadata-file e --external-url.");
  }

  const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const now = new Date().toISOString();
  const { error: cleanupError } = await supabase
    .from("backup_jobs")
    .delete()
    .eq("storage_bucket", "github-releases")
    .lt("expires_at", now);

  if (cleanupError) {
    throw new Error(
      `Nao foi possivel limpar registros externos vencidos: ${cleanupError.message}`,
    );
  }

  const manifest = {
    ...metadata.manifest,
    archive: {
      mode: "github_release",
      file_name: metadata.file_name,
      external_url: externalUrl,
      private_repository: true,
    },
  };
  const { data, error } = await supabase
    .from("backup_jobs")
    .insert({
      company_id: metadata.company_id,
      requested_by: metadata.requested_by,
      trigger_type: metadata.trigger_type,
      status: "completed",
      backup_name: metadata.backup_name,
      storage_bucket: "github-releases",
      storage_path: externalUrl,
      file_size_bytes: metadata.file_size_bytes,
      manifest,
      started_at: metadata.manifest?.generated_at ?? now,
      completed_at: now,
      expires_at: getExpirationDate(),
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel registrar o backup externo.");
  }

  console.log(
    JSON.stringify(
      {
        id: data.id,
        backup_name: metadata.backup_name,
        external_url: externalUrl,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Erro:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
