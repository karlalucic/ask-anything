import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStyleRefinePrompt } from "@/lib/prompts/style";

const bodySchema = z.object({
  styleCard: z.object({
    openingPattern: z.string(),
    chapterShape: z.string(),
    sentenceRhythm: z.string(),
    signatureMoves: z.array(z.string()),
    targetWordCountRange: z.tuple([z.number(), z.number()]),
  }),
  followups: z.array(z.string()),
  answers: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildStyleRefinePrompt(parsed.data) }],
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
