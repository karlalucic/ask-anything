import type { StyleCard, FamiliarityLevel, IntentType, ChapterPlan } from "../types";
import { getDurationWords, getDurationChapters } from "../types";

export function buildOutlinePrompt(params: {
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  styleCard: StyleCard;
}): string {
  const chapterCount = getDurationChapters(params.duration);
  const totalWords = getDurationWords(params.duration);
  const wordsPerChapter = Math.floor(totalWords / chapterCount);

  const familiarityClause: Record<FamiliarityLevel, string> = {
    beginner: "Assume no prior knowledge. Define terms, build from first principles.",
    intermediate: "Assume basic familiarity. Skip fundamentals, focus on nuance and mechanisms.",
    advanced: "Assume deep domain knowledge. Focus on cutting-edge debates and non-obvious insights.",
  };

  const intentClause: Record<IntentType, string> = {
    curious: "Survey-style: cover history, context, and big picture. Prioritize narrative and wonder.",
    work: "Dense and front-loaded: most critical facts and recent developments first. Actionable.",
    comparing: "Decision-oriented: frame options, surface tradeoffs, give a recommendation framework.",
    deep_dive: "Academic depth: include minority positions, edge cases, methodological debates.",
  };

  return `You are producing the chapter outline for an audio briefing.

TOPIC: ${params.topic}
TOTAL TARGET WORDS: ${totalWords} (across ${chapterCount} chapters, ~${wordsPerChapter} words each)
FAMILIARITY: ${familiarityClause[params.familiarity]}
INTENT: ${intentClause[params.intent]}

STYLE CARD (apply to shaping chapter titles and thesis statements):
- Opening pattern: ${params.styleCard.openingPattern}
- Chapter shape: ${params.styleCard.chapterShape}
- Signature moves: ${params.styleCard.signatureMoves.join(", ")}

Produce exactly ${chapterCount} chapters. For each chapter, output JSON matching:
{
  "title": "chapter title",
  "thesis": "one-sentence claim this chapter makes",
  "researchBrief": "what to research: key questions, angles, gaps",
  "searchQueries": ["3-5 web search queries"],
  "evidenceNeeded": ["specific facts, statistics, quotes needed"],
  "targetWords": ${wordsPerChapter}
}

Return a JSON array of ${chapterCount} chapter objects. No prose outside the JSON.`;
}

export function parseOutlineResponse(raw: string): ChapterPlan[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Outline response contained no JSON array");
  return JSON.parse(match[0]) as ChapterPlan[];
}
