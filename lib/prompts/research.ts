import type { ChapterPlan, SourcesConfig } from "../types";

const DEFAULT_SEARCH_BUDGET = 2;
const ACADEMIC_SEARCH_BUDGET = 3;

function searchEnabled(sourcesConfig?: SourcesConfig): boolean {
  return sourcesConfig?.web !== false || sourcesConfig?.academic === true;
}

function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    const bare = trimmed.replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare) ? bare : null;
  }
}

function recencyInstruction(recency?: SourcesConfig["recency"]): string {
  switch (recency) {
    case "past_week":
      return "Prefer sources from the past week; use older sources only for durable background.";
    case "past_month":
      return "Prefer sources from the past month; use older sources only for durable background.";
    case "past_year":
      return "Prefer sources from the past year; use older sources only for durable background.";
    default:
      return "Use the most relevant sources regardless of date, unless the chapter depends on current facts.";
  }
}

export function buildResearchSystemPrompt(sourcesConfig?: SourcesConfig): string {
  const searchBudget = sourcesConfig?.academic ? ACADEMIC_SEARCH_BUDGET : DEFAULT_SEARCH_BUDGET;
  const searchInstructions = searchEnabled(sourcesConfig)
    ? `Use the web_search tool sparingly and deliberately. You have a budget of ${searchBudget} search request(s) for this chapter, so prefer high-signal queries and call done once the evidence is sufficient.`
    : "Do not use web search for this chapter. Use durable background knowledge only, and be explicit in the findings when a claim would need live verification.";

  return `You are a rigorous research assistant for audio content production. Your job is to research a single chapter of an audio briefing.

${searchInstructions}

Prioritize:
- Primary sources over secondary
- Recent publications where recency matters
- Diverse perspectives
- Quotable, specific evidence (statistics, expert quotes, concrete examples)

When you have enough evidence to fully support the chapter thesis and fill the target word count, call the done tool with your structured findings.

Always call done — never end without calling it.`;
}

export function buildResearchUserPrompt(chapter: ChapterPlan, sourcesConfig?: SourcesConfig): string {
  const domainClause = sourcesConfig?.domains.length
    ? `\nPREFERRED DOMAINS:\n${sourcesConfig.domains.map((d) => `- ${d}`).join("\n")}`
    : "";
  const academicClause = sourcesConfig?.academic
    ? "\nACADEMIC MODE: Prefer peer-reviewed papers, university publications, official datasets, and primary research where available."
    : "";

  return `Research this chapter:

TITLE: ${chapter.title}
THESIS: ${chapter.thesis}
RESEARCH BRIEF: ${chapter.researchBrief}
RECENCY: ${recencyInstruction(sourcesConfig?.recency)}${academicClause}${domainClause}

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

export function buildResearchTools(sourcesConfig?: SourcesConfig) {
  const domains = (sourcesConfig?.domains ?? [])
    .map(normalizeDomain)
    .filter((domain): domain is string => Boolean(domain));

  const webSearchTool = searchEnabled(sourcesConfig)
    ? [{
        type: "web_search_20250305" as const,
        name: "web_search" as const,
        max_uses: sourcesConfig?.academic ? ACADEMIC_SEARCH_BUDGET : DEFAULT_SEARCH_BUDGET,
        ...(domains.length > 0 ? { allowed_domains: domains } : {}),
      }]
    : [];

  return [
    ...webSearchTool,
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
}
