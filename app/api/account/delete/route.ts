import { runs } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverError } from "@/lib/api-errors";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

const confirmationSchema = z.object({
  confirmation: z.literal("DELETE"),
});

const ACTIVE_GENERATION_STATUSES = new Set([
  "queued",
  "outlining",
  "researching",
  "drafting",
  "aggregating",
  "synthesizing",
  "canceling",
]);

const STORAGE_BATCH_SIZE = 100;

type GenerationCleanupRow = {
  id: string;
  audio_path: string | null;
  status: string;
  trigger_run_id: string | null;
};

type DocumentCleanupRow = {
  storage_path: string | null;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function removeStoragePaths(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  bucket: string,
  paths: string[],
) {
  for (const batch of chunk(unique(paths), STORAGE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
  }
}

async function listStoragePrefix(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    paths.push(...data.map((entry) => `${prefix}/${entry.name}`));
    offset += data.length;
  }

  return paths;
}

async function cancelActiveRuns(generations: GenerationCleanupRow[]) {
  await Promise.all(
    generations
      .filter((generation) => generation.trigger_run_id && ACTIVE_GENERATION_STATUSES.has(generation.status))
      .map(async (generation) => {
        try {
          await runs.cancel(generation.trigger_run_id!);
        } catch {
          // Account deletion should not be blocked by a stale or already-finished Trigger run.
        }
      }),
  );
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = confirmationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  const { data: generations, error: generationsError } = await service
    .from("generations")
    .select("id, audio_path, status, trigger_run_id")
    .eq("user_id", user.id);

  if (generationsError) {
    return serverError(generationsError, { route: "DELETE /api/account/delete generations", userId: user.id });
  }

  const generationRows = (generations ?? []) as GenerationCleanupRow[];

  const { data: documents, error: documentsError } = await service
    .from("user_documents")
    .select("storage_path")
    .eq("user_id", user.id);

  if (documentsError) {
    return serverError(documentsError, { route: "DELETE /api/account/delete documents", userId: user.id });
  }

  const documentRows = (documents ?? []) as DocumentCleanupRow[];

  try {
    await cancelActiveRuns(generationRows);

    const generationIds = generationRows.map((generation) => generation.id);
    const ttsChunkPaths = (
      await Promise.all(generationIds.map((id) => listStoragePrefix(service, "tts-chunks", id)))
    ).flat();

    const audioPaths = unique([
      ...generationRows.map((generation) => generation.audio_path ?? ""),
      ...await listStoragePrefix(service, "audio", user.id),
    ]);

    const documentPaths = unique([
      ...documentRows.map((document) => document.storage_path ?? ""),
      ...await listStoragePrefix(service, "user-docs", user.id),
    ]);

    await removeStoragePaths(service, "tts-chunks", ttsChunkPaths);
    await removeStoragePaths(service, "audio", audioPaths);
    await removeStoragePaths(service, "user-docs", documentPaths);

    const { error: deleteUserError } = await service.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;
  } catch (error) {
    return serverError(error, { route: "DELETE /api/account/delete", userId: user.id });
  }

  return NextResponse.json({ ok: true });
}
