import { NextResponse } from "next/server";
import { createSignedAudioForPublicShareToken } from "@/features/playback/server";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await createSignedAudioForPublicShareToken(token);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });

  return NextResponse.json(result.audio, {
    headers: { "Cache-Control": "no-store" },
  });
}
