import type { StyleCard } from "../types";

interface AggregateBuild {
  system: string;
  user: string;
}

/**
 * Build a focused aggregation prompt that asks the model to do only what no
 * other stage can do: cross-chapter dedup and bridging. Per-chapter polish
 * (rhythm, signature moves, opening/closing) already happens at draft time,
 * so the model is told here to preserve original draft wording verbatim and
 * only intervene where chapters genuinely overlap or transition abruptly.
 *
 * Concretely this typically halves Haiku's output token count compared to the
 * old "rewrite the whole script" prompt, since the model only re-emits the
 * sentences it's actually changing. Same coherence guarantees, less time
 * watching tokens stream that aren't actually doing work.
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

  const fullScript = chapters.map((c) => c.draft).join("\n\n");

  // Stable across one generation. Worth caching.
  const system = `You are the final editor of an audio briefing script. Each chapter was drafted independently, so chapters cannot reference each other directly and may overlap on facts or examples. Your job is the cross-chapter polish those isolated drafts cannot do for themselves.

Do exactly three things:
1. CROSS-CHAPTER DEDUP. If two chapters cite the same statistic, anecdote, or example, keep it in the chapter where it lands strongest and tighten the duplicate to a brief reference (or delete it).
2. BRIDGING. Where one chapter ends and the next begins, add a single sentence (or extend the existing one) that connects the ideas. Avoid filler like "Now let's talk about" — write the bridge in the same voice as the surrounding prose.
3. WORD COUNT. Trim or expand only as needed to land inside the target range.

Preserve the drafts verbatim everywhere else. Do NOT rewrite paragraphs that already work. Do NOT rephrase for variety. Do NOT change individual word choices unless they are genuinely repeating across chapters. The drafts already match the style card; your job is the seams, not the prose.

STYLE CARD (the drafts already follow this — don't reapply it):
- Opening pattern: ${styleCard.openingPattern}
- Chapter shape: ${styleCard.chapterShape}
- Sentence rhythm: ${styleCard.sentenceRhythm}
- Signature moves: ${styleCard.signatureMoves.join("; ")}

OUTPUT: the complete polished script, no chapter headers, no meta-commentary. Most lines should be identical to the input.`;

  const user = `CURRENT WORD COUNT: ${currentWords}
TARGET: ${minTarget}–${maxTarget} words

DRAFTS TO POLISH (verbatim wherever possible — only touch the seams):
${fullScript}`;

  return { system, user };
}
