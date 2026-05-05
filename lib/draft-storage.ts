import type { FamiliarityLevel, IntentType, SourcesConfig, VoiceId } from "@/lib/types";

export const DRAFT_KEY = "aa:draft:v2";
const LEGACY_DRAFT_KEY = "aa:draft:v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WizardDraftStep = "meta" | "style" | "sources" | "voice" | "review";

export interface WizardDraftV2 {
  v: 2;
  updatedAt: string;
  step: WizardDraftStep;
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  styleInput: string;
  sourcesConfig: SourcesConfig;
  voice: VoiceId;
}

interface LegacyDraftV1 {
  v: 1;
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  styleInput: string;
}

const DEFAULT_SOURCES: SourcesConfig = {
  web: true,
  academic: false,
  userDocs: false,
  recency: "any",
  domains: [],
  userDocIds: [],
};

function isExpired(updatedAt: string): boolean {
  const updatedAtMs = new Date(updatedAt).getTime();
  return !Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > DRAFT_TTL_MS;
}

function normalizeStep(value: unknown): WizardDraftStep {
  return ["meta", "style", "sources", "voice", "review"].includes(String(value))
    ? value as WizardDraftStep
    : "meta";
}

function migrateLegacyDraft(draft: Partial<LegacyDraftV1>): WizardDraftV2 | null {
  if (draft?.v !== 1 || typeof draft.topic !== "string") return null;
  return {
    v: 2,
    updatedAt: new Date().toISOString(),
    step: "meta",
    topic: draft.topic,
    duration: typeof draft.duration === "number" ? draft.duration : 20,
    familiarity: draft.familiarity ?? "intermediate",
    intent: draft.intent ?? "curious",
    styleInput: typeof draft.styleInput === "string" ? draft.styleInput : "",
    sourcesConfig: DEFAULT_SOURCES,
    voice: "ara",
  };
}

export function loadDraft(): WizardDraftV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WizardDraftV2>;
      if (parsed?.v !== 2 || !parsed.updatedAt || isExpired(parsed.updatedAt)) {
        clearDraft();
        return null;
      }
      return {
        v: 2,
        updatedAt: parsed.updatedAt,
        step: normalizeStep(parsed.step),
        topic: typeof parsed.topic === "string" ? parsed.topic : "",
        duration: typeof parsed.duration === "number" ? parsed.duration : 20,
        familiarity: parsed.familiarity ?? "intermediate",
        intent: parsed.intent ?? "curious",
        styleInput: typeof parsed.styleInput === "string" ? parsed.styleInput : "",
        sourcesConfig: parsed.sourcesConfig ?? DEFAULT_SOURCES,
        voice: parsed.voice ?? "ara",
      };
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_DRAFT_KEY);
    if (!legacyRaw) return null;
    const migrated = migrateLegacyDraft(JSON.parse(legacyRaw) as Partial<LegacyDraftV1>);
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    if (migrated) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<WizardDraftV2, "v" | "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: WizardDraftV2 = { v: 2, updatedAt: new Date().toISOString(), ...draft };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable (private mode, quota) — silently no-op
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // no-op
  }
}
