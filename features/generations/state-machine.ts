import type { GenerationStatus } from "@/lib/types";

export type GenerationPhase = "pending" | "work" | "terminal";

export type GenerationUiState = {
  label: string;
  helper: string;
  phase: GenerationPhase;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

export const GENERATION_UI_STATE: Record<GenerationStatus, GenerationUiState> = {
  queued: {
    label: "Queued",
    helper: "Waiting to start",
    phase: "pending",
    badgeVariant: "outline",
  },
  outlining: {
    label: "Outlining",
    helper: "Building the structure",
    phase: "work",
    badgeVariant: "secondary",
  },
  researching: {
    label: "Researching",
    helper: "Gathering sources",
    phase: "work",
    badgeVariant: "secondary",
  },
  drafting: {
    label: "Writing",
    helper: "Drafting the script",
    phase: "work",
    badgeVariant: "secondary",
  },
  aggregating: {
    label: "Polishing",
    helper: "Assembling the final script",
    phase: "work",
    badgeVariant: "secondary",
  },
  synthesizing: {
    label: "Narrating",
    helper: "Generating the MP3",
    phase: "work",
    badgeVariant: "secondary",
  },
  complete: {
    label: "Ready",
    helper: "Listen now",
    phase: "terminal",
    badgeVariant: "default",
  },
  failed: {
    label: "Failed",
    helper: "Open for recovery options",
    phase: "terminal",
    badgeVariant: "destructive",
  },
  canceling: {
    label: "Canceling",
    helper: "Stopping generation",
    phase: "work",
    badgeVariant: "outline",
  },
  canceled: {
    label: "Canceled",
    helper: "Generation stopped",
    phase: "terminal",
    badgeVariant: "outline",
  },
};

export const GENERATION_TRANSITIONS: Record<GenerationStatus, readonly GenerationStatus[]> = {
  queued: ["outlining", "canceling", "failed"],
  outlining: ["researching", "canceling", "failed"],
  researching: ["drafting", "canceling", "failed"],
  drafting: ["aggregating", "synthesizing", "canceling", "failed"],
  aggregating: ["synthesizing", "canceling", "failed"],
  synthesizing: ["complete", "canceling", "failed"],
  complete: [],
  failed: ["queued"],
  canceling: ["canceled", "failed"],
  canceled: ["queued"],
};

export function getGenerationUiState(status: GenerationStatus): GenerationUiState {
  return GENERATION_UI_STATE[status];
}

export function isTerminalGenerationStatus(status: GenerationStatus): boolean {
  return GENERATION_UI_STATE[status].phase === "terminal";
}

export function canTransitionGeneration(from: GenerationStatus, to: GenerationStatus): boolean {
  return GENERATION_TRANSITIONS[from].includes(to);
}
