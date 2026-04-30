export type GenerationStatus =
  | "queued"
  | "outlining"
  | "researching"
  | "drafting"
  | "aggregating"
  | "synthesizing"
  | "complete"
  | "failed"
  | "canceled";

export type DurationPreset = number; // minutes (5–60)
export type FamiliarityLevel = "beginner" | "intermediate" | "advanced";
export type IntentType = "curious" | "work" | "comparing" | "deep_dive";
export type VoiceId = "eve" | "ara" | "rex" | "sal" | "leo";
export type GenerationVisibility = "private" | "public";

export interface StyleCard {
  openingPattern: string;
  chapterShape: string;
  sentenceRhythm: string;
  signatureMoves: string[];
  targetWordCountRange: [number, number];
}

export interface StyleFollowup {
  q: string;
  a: string;
  options?: string[];
}

export interface SourcesConfig {
  web: boolean;
  academic: boolean;
  userDocs: boolean;
  recency: "any" | "past_year" | "past_month" | "past_week";
  domains: string[];
  userDocIds: string[];
}

export interface ChapterPlan {
  title: string;
  thesis: string;
  researchBrief: string;
  searchQueries: string[];
  evidenceNeeded: string[];
  targetWords: number;
}

export interface ChapterResearch {
  keyFindings: string[];
  quotableEvidence: string[];
  sources: { title: string; url: string; snippet: string }[];
}

export interface StageProgress {
  research?: { done: number; total: number };
  drafting?: { done: number; total: number };
  tts?: { done: number; total: number };
}

export interface AppErrorInfo {
  stage: "outline" | "research" | "draft" | "aggregate" | "tts" | "stitch" | "storage" | "style";
  provider: "anthropic" | "xai" | "ffmpeg" | "supabase" | "internal";
  code: string;
  message?: string;
  upstreamStatus?: number;
  upstreamBody?: unknown;
  attempt: number;
  generationId: string;
  chapterIdx?: number;
  retriable: boolean;
  runEventId?: number;
  triggerRunId?: string;
}

export interface Generation {
  id: string;
  userId: string;
  title: string | null;
  topic: string;
  duration: DurationPreset;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  voice: VoiceId;
  styleInput: string;
  styleCard: StyleCard | null;
  styleFollowups: StyleFollowup[] | null;
  sourcesConfig: SourcesConfig;
  outline: ChapterPlan[] | null;
  fullScript: string | null;
  audioPath: string | null;
  audioDurationSeconds: number | null;
  status: GenerationStatus;
  visibility: GenerationVisibility;
  stageProgress: StageProgress;
  error: AppErrorInfo | null;
  triggerRunId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Chapter {
  generationId: string;
  idx: number;
  title: string;
  thesis: string | null;
  researchBrief: string | null;
  searchQueries: string[] | null;
  evidenceNeeded: string[] | null;
  targetWords: number | null;
  research: ChapterResearch | null;
  draft: string | null;
  status: "pending" | "researching" | "drafting" | "done" | "failed";
  error: AppErrorInfo | null;
  updatedAt: string;
}

export function getDurationWords(minutes: number): number {
  return Math.round(minutes * 150);
}

export function getDurationChapters(minutes: number): number {
  return Math.max(3, Math.min(12, Math.round(4 + (minutes - 5) * 6 / 55)));
}

export const VOICE_LABELS: Record<VoiceId, { label: string; description: string }> = {
  eve: { label: "Eve", description: "Energetic, upbeat" },
  ara: { label: "Ara", description: "Warm, conversational" },
  rex: { label: "Rex", description: "Professional, business" },
  sal: { label: "Sal", description: "Versatile, balanced" },
  leo: { label: "Leo", description: "Authoritative, instructional" },
};
