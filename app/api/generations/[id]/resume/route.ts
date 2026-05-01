import { NextRequest, NextResponse } from "next/server";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toGeneration } from "@/lib/supabase/mappers";
import type { generateAudiobook } from "@/trigger/generate-audiobook";

const RESUMABLE_STATUSES = ["failed", "canceled", "queued"];
// Trigger.dev statuses that mean this run is still alive; don't dispatch a new one.
const TRIGGER_ACTIVE_STATUSES = new Set([
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "REATTEMPTING",
  "FROZEN",
  "WAITING",
  "WAITING_TO_RESUME",
  "DELAYED",
]);

function wantsHtml(req: NextRequest): boolean {
  return req.headers.get("accept")?.includes("text/html") ?? false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const generation = toGeneration(data);

  // A cancel that's still propagating to Trigger.dev: refuse to stack a new
  // run on top. Caller should retry once the cancel finishes flipping the row
  // to "canceled".
  if (generation.status === "canceling") {
    return NextResponse.json({ error: "Cancellation in progress, try again in a moment" }, { status: 409 });
  }

  if (!RESUMABLE_STATUSES.includes(generation.status)) {
    return NextResponse.json({ error: "Generation is not resumable" }, { status: 400 });
  }

  if (!generation.styleCard) {
    return NextResponse.json({ error: "Generation is missing style configuration" }, { status: 400 });
  }

  // If the previous Trigger.dev run is still alive, refuse to dispatch a new
  // one. Double-dispatch would double-bill Anthropic and cause concurrent
  // writes to the same generation row. Let the existing run keep going.
  if (generation.triggerRunId) {
    try {
      const existing = await runs.retrieve(generation.triggerRunId);
      if (existing && TRIGGER_ACTIVE_STATUSES.has(existing.status)) {
        return NextResponse.json(
          { error: "Generation is already running", runId: existing.id },
          { status: 409 },
        );
      }
    } catch {
      // Run not found or Trigger.dev unreachable. Fall through and dispatch.
      // The worst case is a duplicate run, which the in-task idempotency
      // guards (existing chapter/audio short-circuits) already handle.
    }
  }

  const handle = await tasks.trigger<typeof generateAudiobook>("generate-audiobook", {
    generationId: generation.id,
    userId: user.id,
    topic: generation.topic,
    duration: generation.duration,
    familiarity: generation.familiarity,
    intent: generation.intent,
    voice: generation.voice,
    styleCard: generation.styleCard,
    sourcesConfig: generation.sourcesConfig,
  });

  await supabase
    .from("generations")
    .update({
      status: "queued",
      error: null,
      trigger_run_id: handle.id,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (wantsHtml(req)) {
    return NextResponse.redirect(new URL(`/listen/${id}`, req.url), { status: 303 });
  }

  return NextResponse.json({ ok: true, runId: handle.id });
}
