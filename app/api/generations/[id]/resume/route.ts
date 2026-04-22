import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toGeneration } from "@/lib/supabase/mappers";
import type { generateAudiobook } from "@/trigger/generate-audiobook";

const RESUMABLE_STATUSES = ["failed", "canceled", "queued"];

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
  if (!RESUMABLE_STATUSES.includes(generation.status)) {
    return NextResponse.json({ error: "Generation is not resumable" }, { status: 400 });
  }

  if (!generation.styleCard) {
    return NextResponse.json({ error: "Generation is missing style configuration" }, { status: 400 });
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
