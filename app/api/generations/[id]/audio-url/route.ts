import { NextResponse } from "next/server";
import { createSignedAudioForAccessibleGeneration } from "@/features/playback/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await createSignedAudioForAccessibleGeneration(supabase, id, user.id);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });

  return NextResponse.json(result.audio, {
    headers: { "Cache-Control": "no-store" },
  });
}
