import type { ChapterResearch } from "./types";

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return trimmed
          .slice(1, -1)
          .split(/\n+/)
          .map((line) => line.trim().replace(/,$/, ""))
          .filter(Boolean)
          .map((line) => {
            if (line.startsWith("\"") && line.endsWith("\"")) {
              return line.slice(1, -1).replace(/\\"/g, "\"");
            }
            return line;
          });
      }
      return value.trim() ? [value] : [];
    }
  }

  return [];
}

function parseStringArray(value: unknown): string[] {
  return parseArray(value)
    .map((item) => {
      if (typeof item === "string") return item;
      if (item == null) return "";
      return JSON.stringify(item);
    })
    .filter(Boolean);
}

function parseSources(value: unknown): ChapterResearch["sources"] {
  return parseArray(value).map((item) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      title: typeof source.title === "string" ? source.title : "",
      url: typeof source.url === "string" ? source.url : "",
      snippet: typeof source.snippet === "string" ? source.snippet : "",
    };
  }).filter((source) => source.title || source.url || source.snippet);
}

export function normalizeChapterResearch(value: unknown): ChapterResearch {
  const research = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    keyFindings: parseStringArray(research.keyFindings),
    quotableEvidence: parseStringArray(research.quotableEvidence),
    sources: parseSources(research.sources),
  };
}
