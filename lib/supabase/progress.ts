import { createClient } from "@supabase/supabase-js";
import type { GenerationStatus, StageProgress, AppErrorInfo } from "../types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function setGenerationStatus(
  generationId: string,
  status: GenerationStatus,
  extra?: Partial<{ completedAt: string; error: AppErrorInfo }>,
) {
  const supabase = serviceClient();
  const update: Record<string, unknown> = { status };
  if (extra?.completedAt) update.completed_at = extra.completedAt;
  if (extra?.error) update.error = extra.error;

  const { error } = await supabase
    .from("generations")
    .update(update)
    .eq("id", generationId);

  if (error) throw new Error(`Failed to update status to ${status}: ${error.message}`);
}

export async function bumpProgress(
  generationId: string,
  key: keyof StageProgress,
  patch: { done: number; total: number },
) {
  const supabase = serviceClient();
  const { error } = await supabase.rpc("merge_stage_progress", {
    gen_id: generationId,
    progress_key: key,
    done_val: patch.done,
    total_val: patch.total,
  });
  if (error) {
    // Fallback: fetch-then-update if RPC not yet deployed
    const { data } = await supabase
      .from("generations")
      .select("stage_progress")
      .eq("id", generationId)
      .single();
    const current = (data?.stage_progress ?? {}) as StageProgress;
    await supabase
      .from("generations")
      .update({ stage_progress: { ...current, [key]: patch } })
      .eq("id", generationId);
  }
}

export async function setChapterStatus(
  generationId: string,
  idx: number,
  status: string,
  extra?: Partial<{ research: unknown; draft: string; error: AppErrorInfo }>,
) {
  const supabase = serviceClient();
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (extra?.research !== undefined) update.research = extra.research;
  if (extra?.draft !== undefined) update.draft = extra.draft;
  if (extra?.error !== undefined) update.error = extra.error;

  const { error } = await supabase
    .from("chapters")
    .update(update)
    .eq("generation_id", generationId)
    .eq("idx", idx);

  if (error) throw new Error(`Failed to update chapter ${idx} status: ${error.message}`);
}

export async function logRunEvent(event: {
  generationId: string;
  chapterIdx?: number;
  stage: string;
  provider?: string;
  kind: "call" | "tool_call" | "retry" | "error" | "info";
  attempt?: number;
  durationMs?: number;
  payload?: unknown;
  response?: unknown;
  error?: unknown;
}) {
  const supabase = serviceClient();
  await supabase.from("run_events").insert({
    generation_id: event.generationId,
    chapter_idx: event.chapterIdx ?? null,
    stage: event.stage,
    provider: event.provider ?? null,
    kind: event.kind,
    attempt: event.attempt ?? null,
    duration_ms: event.durationMs ?? null,
    payload: event.payload ?? null,
    response: event.response ?? null,
    error: event.error ?? null,
  });
}
