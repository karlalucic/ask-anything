import type { ChapterPlan } from "../types";

export function buildResearchSystemPrompt(): string {
  return `You are a rigorous research assistant for audio content production. Your job is to research a single chapter of an audio briefing.

Use the web_search tool to find high-quality, accurate information. Prioritize:
- Primary sources over secondary
- Recent publications where recency matters
- Diverse perspectives
- Quotable, specific evidence (statistics, expert quotes, concrete examples)

When you have enough evidence to fully support the chapter thesis and fill the target word count, call the done tool with your structured findings.

Always call done — never end without calling it.`;
}

export function buildResearchUserPrompt(chapter: ChapterPlan): string {
  return `Research this chapter:

TITLE: ${chapter.title}
THESIS: ${chapter.thesis}
RESEARCH BRIEF: ${chapter.researchBrief}

SEARCH QUERIES TO START WITH:
${chapter.searchQueries.map((q) => `- ${q}`).join("\n")}

EVIDENCE NEEDED:
${chapter.evidenceNeeded.map((e) => `- ${e}`).join("\n")}

TARGET LENGTH: ~${chapter.targetWords} words when written

Search thoroughly, then call the done tool with:
{
  "keyFindings": ["5-10 key facts or insights discovered"],
  "quotableEvidence": ["specific quotes, statistics, or examples with source attribution"],
  "sources": [{"title": "...", "url": "...", "snippet": "..."}]
}`;
}

export const RESEARCH_TOOLS = [
  {
    type: "web_search_20250305" as const,
    name: "web_search",
  },
  {
    name: "done",
    description: "Signal research completion and return structured findings",
    input_schema: {
      type: "object" as const,
      properties: {
        keyFindings: {
          type: "array",
          items: { type: "string" },
          description: "Key facts and insights discovered",
        },
        quotableEvidence: {
          type: "array",
          items: { type: "string" },
          description: "Specific quotes, statistics, or examples with attribution",
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              snippet: { type: "string" },
            },
            required: ["title", "url", "snippet"],
          },
        },
      },
      required: ["keyFindings", "quotableEvidence", "sources"],
    },
  },
];
