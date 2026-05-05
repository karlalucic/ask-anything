import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-errors";
import { createAudioSignedUrlResponse } from "@/lib/supabase/audio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation, error } = await supabase
    .from("generations")
    .select("id, status, audio_path")
    .eq("id", id)
    .single();

  if (error || !generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (generation.status !== "complete" || !generation.audio_path) {
    return NextResponse.json({ error: "Audio not available" }, { status: 404 });
  }

  try {
    const response = await createAudioSignedUrlResponse(generation.audio_path);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/generations/[id]/audio-url", userId: user.id });
  }
}
