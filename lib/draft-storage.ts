import type { FamiliarityLevel, IntentType } from "@/lib/types";

const DRAFT_KEY = "aa:draft:v1";

export interface Draft {
  v: 1;
  topic: string;
  duration: number;
  familiarity: FamiliarityLevel;
  intent: IntentType;
  styleInput: string;
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (parsed?.v !== 1) return null;
    return parsed as Draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<Draft, "v">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Draft = { v: 1, ...draft };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // localStorage unavailable (private mode, quota) — silently no-op
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // no-op
  }
}
