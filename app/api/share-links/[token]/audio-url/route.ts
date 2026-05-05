import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-errors";
import { createAudioSignedUrlResponse } from "@/lib/supabase/audio";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: link, error: linkError } = await supabase
    .from("share_links")
    .select("generation_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (linkError || !link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .select("id, status, visibility, audio_path")
    .eq("id", link.generation_id)
    .eq("status", "complete")
    .eq("visibility", "public")
    .single();

  if (generationError || !generation?.audio_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const response = await createAudioSignedUrlResponse(generation.audio_path);
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/share-links/[token]/audio-url" });
  }
}
