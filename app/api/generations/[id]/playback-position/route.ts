import { NextResponse } from "next/server";
import {
  getPlaybackPosition,
  playbackPositionSchema,
  upsertPlaybackPosition,
} from "@/features/playback/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getPlaybackPosition(supabase, id, user.id);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });

  return NextResponse.json(result.playbackPosition, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = playbackPositionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await upsertPlaybackPosition(supabase, {
    generationId: id,
    userId: user.id,
    positionSeconds: parsed.data.positionSeconds,
    durationSeconds: parsed.data.durationSeconds ?? null,
  });
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });

  return NextResponse.json(result.playbackPosition, {
    headers: { "Cache-Control": "no-store" },
  });
}
