import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tasks } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toGeneration } from "@/lib/supabase/mappers";
import type { generateAudiobook } from "@/trigger/generate-audiobook";
import { captureServerEvent } from "@/lib/posthog-server";
import { serverError } from "@/lib/api-errors";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const bodySchema = z.object({
  topic: z.string().min(1).max(1500),
  duration: z.number().int().min(5).max(60),
  familiarity: z.enum(["beginner", "intermediate", "advanced"]),
  intent: z.enum(["curious", "work", "comparing", "deep_dive"]),
  voice: z.enum(["eve", "ara", "rex", "sal", "leo"]),
  styleInput: z.string().min(1).max(200),
  styleCard: z.object({
    openingPattern: z.string().max(1000),
    chapterShape: z.string().max(1000),
    sentenceRhythm: z.string().max(1000),
    signatureMoves: z.array(z.string().max(300)).max(8),
    targetWordCountRange: z.tuple([z.number(), z.number()]),
  }),
  styleFollowups: z.array(z.object({ q: z.string().max(500), a: z.string().max(500) })).max(5).optional(),
  sourcesConfig: z.object({
    web: z.boolean(),
    academic: z.boolean(),
    userDocs: z.boolean(),
    recency: z.enum(["any", "past_year", "past_month", "past_week"]),
    domains: z.array(z.string().max(253)).max(10),
    userDocIds: z.array(z.string().uuid()).max(20),
  }),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return NextResponse.json({ error: `Invalid request: ${message}` }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      title: parsed.data.topic,
      topic: parsed.data.topic,
      duration: parsed.data.duration,
      familiarity: parsed.data.familiarity,
      intent: parsed.data.intent,
      voice: parsed.data.voice,
      style_input: parsed.data.styleInput,
      style_card: parsed.data.styleCard,
      style_followups: parsed.data.styleFollowups ?? [],
      sources_config: parsed.data.sourcesConfig,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Failed to create generation" }, { status: 500 });
  }

  const handle = await tasks.trigger<typeof generateAudiobook>("generate-audiobook", {
    generationId: row.id,
    userId: user.id,
    topic: parsed.data.topic,
    duration: parsed.data.duration,
    familiarity: parsed.data.familiarity,
    intent: parsed.data.intent,
    voice: parsed.data.voice,
    styleCard: parsed.data.styleCard,
    sourcesConfig: parsed.data.sourcesConfig,
  });

  await supabase.from("generations").update({ trigger_run_id: handle.id }).eq("id", row.id);

  captureServerEvent({
    distinctId: user.id,
    event: "generation_created",
    properties: {
      generation_id: row.id,
      topic_length: parsed.data.topic.length,
      duration: parsed.data.duration,
      familiarity: parsed.data.familiarity,
      intent: parsed.data.intent,
      voice: parsed.data.voice,
      sources_web: parsed.data.sourcesConfig.web,
      sources_academic: parsed.data.sourcesConfig.academic,
    },
  });

  const response = NextResponse.json({ id: row.id });
  response.headers.set("X-Generation-Id", row.id);
  return response;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  const { limit, offset } = parsed.data;

  const { data, error } = await supabase
    .from("generations")
    .select("id, user_id, title, topic, duration, status, visibility, stage_progress, audio_path, audio_duration_seconds, error, created_at, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return serverError(error, { route: "GET /api/generations", userId: user.id });
  return NextResponse.json({ generations: (data ?? []).map(toGeneration) });
}
