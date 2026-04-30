import type { Chapter, Generation } from "@/lib/types";

type RecordLike = Record<string, unknown>;

function read<T>(row: RecordLike, snakeKey: string, camelKey: string, fallback: T): T {
  return (row[snakeKey] ?? row[camelKey] ?? fallback) as T;
}

export function toChapter(row: unknown): Chapter {
  const data = (row ?? {}) as RecordLike;

  return {
    generationId: read(data, "generation_id", "generationId", ""),
    idx: read(data, "idx", "idx", 0),
    title: read(data, "title", "title", ""),
    thesis: read(data, "thesis", "thesis", null),
    researchBrief: read(data, "research_brief", "researchBrief", null),
    searchQueries: read(data, "search_queries", "searchQueries", null),
    evidenceNeeded: read(data, "evidence_needed", "evidenceNeeded", null),
    targetWords: read(data, "target_words", "targetWords", null),
    research: read(data, "research", "research", null),
    draft: read(data, "draft", "draft", null),
    status: read(data, "status", "status", "pending"),
    error: read(data, "error", "error", null),
    updatedAt: read(data, "updated_at", "updatedAt", ""),
  };
}

export function toGeneration(row: unknown): Generation {
  const data = (row ?? {}) as RecordLike;

  return {
    id: read(data, "id", "id", ""),
    userId: read(data, "user_id", "userId", ""),
    title: read(data, "title", "title", null),
    topic: read(data, "topic", "topic", ""),
    duration: read(data, "duration", "duration", 20),
    familiarity: read(data, "familiarity", "familiarity", "intermediate"),
    intent: read(data, "intent", "intent", "curious"),
    voice: read(data, "voice", "voice", "ara"),
    styleInput: read(data, "style_input", "styleInput", ""),
    styleCard: read(data, "style_card", "styleCard", null),
    styleFollowups: read(data, "style_followups", "styleFollowups", null),
    sourcesConfig: read(data, "sources_config", "sourcesConfig", {
      web: true,
      academic: false,
      userDocs: false,
      recency: "any",
      domains: [],
      userDocIds: [],
    }),
    outline: read(data, "outline", "outline", null),
    fullScript: read(data, "full_script", "fullScript", null),
    audioPath: read(data, "audio_path", "audioPath", null),
    audioDurationSeconds: read(data, "audio_duration_seconds", "audioDurationSeconds", null),
    status: read(data, "status", "status", "queued"),
    visibility: read(data, "visibility", "visibility", "private"),
    stageProgress: read(data, "stage_progress", "stageProgress", {}),
    error: read(data, "error", "error", null),
    triggerRunId: read(data, "trigger_run_id", "triggerRunId", null),
    createdAt: read(data, "created_at", "createdAt", ""),
    completedAt: read(data, "completed_at", "completedAt", null),
  };
}

export function toGenerationWithChapters(row: unknown): Generation & { chapters: Chapter[] } {
  const data = (row ?? {}) as RecordLike;
  const chapters = Array.isArray(data.chapters) ? data.chapters.map(toChapter) : [];

  return {
    ...toGeneration(data),
    chapters,
  };
}
