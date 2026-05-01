import type { ChapterPlan, ChapterResearch, StyleCard } from "../types";
import { normalizeChapterResearch } from "../research";

/**
 * Split the draft prompt so the parts that are identical across every chapter
 * of a generation (style card, instructions) can be sent as a cacheable system
 * prompt, and only the per-chapter variable parts ride on the user message.
 * After the first chapter warms the cache, subsequent chapters in the same run
 * read the prefix back at ~90% input-token discount.
 */
export function buildDraftPrompt(params: {
  chapter: ChapterPlan;
  research: ChapterResearch;
  styleCard: StyleCard;
  chapterNumber: number;
  totalChapters: number;
  isFirst: boolean;
  isLast: boolean;
}): { system: string; user: string } {
  const { chapter, styleCard, chapterNumber, totalChapters, isFirst, isLast } = params;
  const research = normalizeChapterResearch(params.research);

  // Stable across all chapters of one generation — cache target.
  const system = `You are writing chapters of an audio briefing. Each chapter you write will be assembled directly with the surrounding chapters, so open and close with natural continuity rather than labels or recap-heavy framing. Apply the style card below precisely.

STYLE CARD:
- Opening pattern: ${styleCard.openingPattern}
- Chapter shape: ${styleCard.chapterShape}
- Sentence rhythm: ${styleCard.sentenceRhythm}
- Signature moves to use: ${styleCard.signatureMoves.join("; ")}

INSTRUCTIONS:
- Write for audio — use spoken language, no bullet lists, no markdown headers
- If you are not writing the first chapter, orient the listener in one sentence without reintroducing the entire topic
- If you are not writing the final chapter, end with a subtle handoff into the next idea rather than a hard conclusion
- Use natural speech-control markers where appropriate: [pause] for emphasis, [laugh] for warmth
- Attribute sources naturally in speech ("According to...", "Researchers at MIT found...")
- Hit the target word count ±10%
- Never mention that this is AI-generated
- Write the full chapter text only. No meta-commentary.`;

  // Per-chapter variable content.
  const positionNote = isFirst
    ? "This is Chapter 1 — also open the entire briefing."
    : isLast
      ? "This is the FINAL chapter — provide a satisfying close to the entire briefing."
      : "";

  const user = `Write Chapter ${chapterNumber} of ${totalChapters}.${positionNote ? `\n${positionNote}` : ""}

CHAPTER TITLE: ${chapter.title}
THESIS: ${chapter.thesis}
TARGET WORDS: ${chapter.targetWords}

RESEARCH FINDINGS:
Key findings:
${research.keyFindings.map((f) => `- ${f}`).join("\n")}

Quotable evidence:
${research.quotableEvidence.map((q) => `- ${q}`).join("\n")}`;

  return { system, user };
}
