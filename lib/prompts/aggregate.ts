import type { StyleCard } from "../types";

export function buildAggregatePrompt(params: {
  chapters: { title: string; draft: string }[];
  styleCard: StyleCard;
  targetTotalWords: number;
}): string {
  const { chapters, styleCard, targetTotalWords } = params;
  const currentWords = chapters.reduce((sum, c) => sum + c.draft.split(/\s+/).length, 0);
  const minTarget = Math.floor(targetTotalWords * 0.97);
  const maxTarget = Math.ceil(targetTotalWords * 1.03);

  const fullScript = chapters.map((c) => c.draft).join("\n\n");

  return `You are the final editor of an audio briefing script. The script was written chapter-by-chapter and needs polish to feel like one coherent piece.

STYLE CARD:
- Opening pattern: ${styleCard.openingPattern}
- Chapter shape: ${styleCard.chapterShape}
- Sentence rhythm: ${styleCard.sentenceRhythm}
- Signature moves: ${styleCard.signatureMoves.join("; ")}
- Target word count range: ${styleCard.targetWordCountRange[0]}-${styleCard.targetWordCountRange[1]}

CURRENT WORD COUNT: ${currentWords}
TARGET: ${minTarget}-${maxTarget} words

YOUR TASKS:
1. Smooth chapter transitions, add brief bridging sentences between chapters
2. Enforce consistent sentence rhythm throughout
3. Ensure signature moves appear throughout (not just in early chapters)
4. Trim or expand to hit the word count target
5. Check for repetition across chapters and remove redundancies
6. Ensure the opening and closing are strong per the style card

FULL SCRIPT:
${fullScript}

Return the complete polished script only. No meta-commentary, no chapter headers, just the audio script text.`;
}
