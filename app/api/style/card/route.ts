import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStyleCardPrompt } from "@/lib/prompts/style";
import { recordProviderUsage } from "@/lib/usage/record";

const bodySchema = z.object({
  styleInput: z.string().min(1).max(200),
  topic: z.string().min(1).max(500),
  familiarity: z.enum(["beginner", "intermediate", "advanced"]),
  intent: z.enum(["curious", "work", "comparing", "deep_dive"]),
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
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildStyleCardPrompt(parsed.data) }],
  });
  await recordProviderUsage({
    userId: user.id,
    stage: "style_card",
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

  let result: unknown;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    result = JSON.parse(match?.[0] ?? text);
  } catch {
    return NextResponse.json({ error: "Failed to parse style card from model response" }, { status: 500 });
  }

  return NextResponse.json(result);
}
