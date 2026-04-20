import type { ChapterPlan, ChapterResearch, StyleCard } from "../types";
import { normalizeChapterResearch } from "../research";

export function buildDraftPrompt(params: {
  chapter: ChapterPlan;
  research: ChapterResearch;
  styleCard: StyleCard;
  chapterNumber: number;
  totalChapters: number;
  isFirst: boolean;
  isLast: boolean;
}): string {
  const { chapter, styleCard, chapterNumber, totalChapters, isFirst, isLast } = params;
  const research = normalizeChapterResearch(params.research);

  return `You are writing Chapter ${chapterNumber} of ${totalChapters} for an audio briefing. Write this chapter only — do not reference other chapters.

CHAPTER TITLE: ${chapter.title}
THESIS: ${chapter.thesis}
TARGET WORDS: ${chapter.targetWords}

STYLE CARD (apply these precisely):
- Opening pattern: ${styleCard.openingPattern}${isFirst ? " (this is the FIRST chapter — also open the entire briefing)" : ""}
- Chapter shape: ${styleCard.chapterShape}
- Sentence rhythm: ${styleCard.sentenceRhythm}
- Signature moves to use: ${styleCard.signatureMoves.join("; ")}
${isLast ? "- This is the FINAL chapter — provide a satisfying close to the entire briefing" : ""}

RESEARCH FINDINGS:
Key findings:
${research.keyFindings.map((f) => `- ${f}`).join("\n")}

Quotable evidence:
${research.quotableEvidence.map((q) => `- ${q}`).join("\n")}

INSTRUCTIONS:
- Write for audio — use spoken language, no bullet lists, no markdown headers
- Use natural speech-control markers where appropriate: [pause] for emphasis, [laugh] for warmth
- Attribute sources naturally in speech ("According to...", "Researchers at MIT found...")
- Hit the target word count ±10%
- Never mention that this is AI-generated
- Write the full chapter text only. No meta-commentary.`;
}
