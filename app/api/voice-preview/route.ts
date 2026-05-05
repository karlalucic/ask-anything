import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverError } from "@/lib/api-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordProviderUsage } from "@/lib/usage/record";
import type { VoiceId } from "@/lib/types";

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const PREVIEW_TEXT = "Here is a quick preview of this voice for your personal podcast.";
const voicePreviewSchema = z.object({
  voice: z.enum(["eve", "ara", "rex", "sal", "leo"]),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = voicePreviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid voice" }, { status: 400 });

  const voice = parsed.data.voice as VoiceId;
  const startTime = Date.now();

  try {
    const response = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: PREVIEW_TEXT,
        voice_id: voice,
        language: "en",
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
        text_normalization: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`xAI voice preview returned ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    await recordProviderUsage({
      userId: user.id,
      stage: "tts",
      provider: "xai",
      model: "xai-tts-preview",
      variant: voice,
      ttsCharacters: PREVIEW_TEXT.length,
      durationMs: Date.now() - startTime,
    });

    return new NextResponse(audioBuffer, {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": "audio/mpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return serverError(err, {
      route: "POST /api/voice-preview",
      userId: user.id,
      extra: { voice },
    });
  }
}
