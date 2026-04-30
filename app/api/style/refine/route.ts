import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStyleRefinePrompt } from "@/lib/prompts/style";
import { recordProviderUsage } from "@/lib/usage/record";

const bodySchema = z.object({
  styleCard: z.object({
    openingPattern: z.string().max(1000),
    chapterShape: z.string().max(1000),
    sentenceRhythm: z.string().max(1000),
    signatureMoves: z.array(z.string().max(300)).max(8),
    targetWordCountRange: z.tuple([z.number(), z.number()]),
  }),
  followups: z.array(z.string().max(500)).max(5),
  answers: z.array(z.string().max(500)).max(5),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const startedAt = Date.now();
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildStyleRefinePrompt(parsed.data) }],
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: `Anthropic API error: ${e.message ?? "unknown"}` },
      { status: e.status ?? 500 },
    );
  }
  await recordProviderUsage({
    userId: user.id,
    stage: "style_refine",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    webSearchRequests: response.usage.server_tool_use?.web_search_requests ?? 0,
    durationMs: Date.now() - startedAt,
  });

  const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

  let refined: unknown;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    refined = JSON.parse(match?.[0] ?? text);
  } catch {
    return NextResponse.json({ error: "Failed to parse refined style card" }, { status: 500 });
  }

  return NextResponse.json({ styleCard: refined });
}
