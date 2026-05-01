import type { StyleCard } from "../types";

interface AggregateBuild {
  system: string;
  user: string;
}

/**
 * Sonnet-driven aggregation that polishes chapter drafts into a coherent
 * audio briefing and returns the result as per-chapter JSON. The output
 * shape preserves chapter boundaries so the orchestrator can keep per-
 * chapter TTS chunking after aggregation runs, while the prompt itself
 * gives Sonnet full latitude to rewrite, dedup, and tighten the prose
 * (rather than just touching the seams).
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

  // Stable across one generation; cache eligible.
  const system = `You are the final editor of an audio briefing script. Each chapter was drafted independently, so chapters haven't seen each other and your job is to make them feel like one coherent piece for a listener.

YOUR TASKS (priority order):
1. CROSS-CHAPTER DEDUP. If two chapters cite the same statistic, anecdote, or example, keep it where it lands strongest and tighten the duplicate to a brief reference or remove it.
2. BRIDGING. At the START of each receiving chapter (chapter 2 onward), add or rewrite a sentence that connects to the previous chapter's idea so the listener never feels a hard break. Avoid filler like "Now let's talk about" — write the bridge in the same voice as the surrounding prose.
3. PROSE LIFT. Where a sentence is genuinely rough — awkward phrasing, muddy verb, redundant clause — tighten it. Don't go looking for things to change; only intervene where intervention helps.
4. OPENING + CLOSING. Make sure chapter 0's first paragraph hooks the listener and the final chapter's last line lands.

The drafts already follow the style card — don't reapply rhythm or signature-move guidance globally. The style card below is reference material, not a checklist to enforce.

STYLE CARD (reference, drafts already match):
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

Each "polished" string is the complete chapter ready for narration: any bridging sentence at the start (for chapters after the first), then the chapter body. Do not include chapter titles or labels. Do not abbreviate or use placeholders. Every chapter must contain its complete polished text.`;

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
  // line before/after, so extract the first balanced JSON object.
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
