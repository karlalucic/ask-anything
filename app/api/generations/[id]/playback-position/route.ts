import { NextResponse } from "next/server";
import { z } from "zod";
import { serverError } from "@/lib/api-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_POSITION_SECONDS = 24 * 60 * 60;

const bodySchema = z.object({
  positionSeconds: z.number().min(0).max(MAX_POSITION_SECONDS),
  durationSeconds: z.number().min(0).max(MAX_POSITION_SECONDS).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("id", id)
    .single();

  if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("generation_playback_positions")
    .select("generation_id, position_seconds, duration_seconds, updated_at")
    .eq("generation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return serverError(error, { route: "GET /api/generations/[id]/playback-position", userId: user.id });

  return NextResponse.json({
    generationId: id,
    positionSeconds: data?.position_seconds ?? 0,
    durationSeconds: data?.duration_seconds ?? null,
    updatedAt: data?.updated_at ?? null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("id", id)
    .single();

  if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const positionSeconds = Math.round(parsed.data.positionSeconds);
  const durationSeconds = parsed.data.durationSeconds == null
    ? null
    : Math.round(parsed.data.durationSeconds);

  const { error } = await supabase
    .from("generation_playback_positions")
    .upsert({
      user_id: user.id,
      generation_id: id,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      updated_at: now,
    }, { onConflict: "user_id,generation_id" });

  if (error) return serverError(error, { route: "PATCH /api/generations/[id]/playback-position", userId: user.id });

  return NextResponse.json({
    generationId: id,
    positionSeconds,
    durationSeconds,
    updatedAt: now,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
