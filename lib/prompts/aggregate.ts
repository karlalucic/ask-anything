import type { StyleCard } from "../types";

interface AggregateBuild {
  system: string;
  user: string;
}

/**
 * Build a focused aggregation prompt that asks the model to polish chapter
 * drafts cross-chapter (dedup + bridging + word-count) while preserving
 * individual draft wording wherever possible. Output is structured per
 * chapter so the orchestrator can keep per-chapter audio chunking after
 * aggregation, instead of falling back to monolithic chunking on a single
 * polished string.
 *
 * Per-chapter output also makes the seams the model produces (any added
 * bridge sentences) attach naturally to the chapter that owns them, rather
 * than living somewhere in a re-flowed continuous string.
 */
export function buildAggregatePrompt(params: {
  chapters: { title: string; draft: string }[];
  styleCard: StyleCard;
  targetTotalWords: number;
}): AggregateBuild {
  const { chapters, styleCard, targetTotalWords } = params;
  const currentWords = chapters.reduce((sum, c) => sum + c.draft.split(/\s+/).length, 0);
  const minTarget = Math.floor(targetTotalWords * 0.97);
  const maxTarget = Math.ceil(targetTotalWords * 1.03);

  // Stable across one generation (cacheable).
  const system = `You are the final editor of an audio briefing script. Each chapter was drafted independently, so chapters cannot reference each other directly and may overlap on facts or examples. Your job is the cross-chapter polish those isolated drafts cannot do for themselves.

Do exactly three things:
1. CROSS-CHAPTER DEDUP. If two chapters cite the same statistic, anecdote, or example, keep it in the chapter where it lands strongest and tighten the duplicate to a brief reference (or delete it).
2. BRIDGING. Where one chapter ends and the next begins, add a single sentence (or extend the existing one) that connects the ideas. Place this sentence at the START of the receiving chapter, not at the end of the previous one. Avoid filler like "Now let's talk about" — write the bridge in the same voice as the surrounding prose.
3. WORD COUNT. Trim or expand only as needed to land inside the target range.

Preserve the drafts verbatim everywhere else. Do NOT rewrite paragraphs that already work. Do NOT rephrase for variety. Do NOT change individual word choices unless they are genuinely repeating across chapters. The drafts already match the style card; your job is the seams, not the prose.

STYLE CARD (the drafts already follow this — don't reapply it):
- Opening pattern: ${styleCard.openingPattern}
- Chapter shape: ${styleCard.chapterShape}
- Sentence rhythm: ${styleCard.sentenceRhythm}
- Signature moves: ${styleCard.signatureMoves.join("; ")}

OUTPUT FORMAT: Return a JSON object only, no prose, no markdown fences:

{
  "chapters": [
    { "idx": 0, "polished": "the full polished text of chapter 0" },
    { "idx": 1, "polished": "the full polished text of chapter 1" }
  ]
}

Each "polished" string is the complete chapter ready for narration: any bridging sentence at the start (for chapters after the first), then the chapter body mostly verbatim from the input. Do not include chapter titles or labels.`;

  const draftsBlock = chapters
    .map((c, i) => `CHAPTER ${i}:\n${c.draft.trim()}`)
    .join("\n\n---\n\n");

  const user = `CURRENT WORD COUNT: ${currentWords}
TARGET: ${minTarget}–${maxTarget} words

DRAFTS TO POLISH (return polished JSON, ${chapters.length} chapters, idx 0..${chapters.length - 1}):

${draftsBlock}`;

  return { system, user };
}

/**
 * Parse the structured JSON output from buildAggregatePrompt. Returns the
 * polished chapters in idx order, or null if the response can't be parsed
 * or doesn't match the expected shape.
 */
export function parseAggregateResponse(
  text: string,
  expectedChapterCount: number,
): string[] | null {
  // Tolerate the model wrapping the JSON in markdown fences or adding a stray
  // line before/after — extract the first balanced JSON object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("chapters" in parsed) ||
    !Array.isArray((parsed as { chapters: unknown }).chapters)
  ) {
    return null;
  }

  const items = (parsed as { chapters: { idx?: unknown; polished?: unknown }[] }).chapters;
  if (items.length !== expectedChapterCount) return null;

  const sorted = [...items].sort((a, b) => Number(a.idx ?? 0) - Number(b.idx ?? 0));
  const polished = sorted.map((c) => (typeof c.polished === "string" ? c.polished.trim() : ""));
  if (polished.some((p) => !p)) return null;

  return polished;
}
