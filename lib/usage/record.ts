import { createClient } from "@supabase/supabase-js";
import {
  computeAnthropicCostUsd,
  computePerplexityCostUsd,
  computeXaiTtsCostUsd,
} from "../billing/pricing";

export type UsageStage =
  | "outline"
  | "research"
  | "draft"
  | "aggregate"
  | "tts"
  | "style_card"
  | "style_refine"
  | "digest";

export type UsageProvider = "anthropic" | "perplexity" | "xai" | "openai" | "exa" | "tavily";

interface RecordUsageInput {
  generationId?: string | null;
  userId?: string | null;
  chapterIdx?: number | null;
  stage: UsageStage;
  provider: UsageProvider;
  model: string;
  variant?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
  toolCalls?: number;
  /** Anthropic-only: paid web_search calls from `usage.server_tool_use.web_search_requests`. */
  webSearchRequests?: number;
  ttsCharacters?: number | null;
  /** For Perplexity: count of API requests (typically 1). */
  requestCount?: number;
  durationMs?: number | null;
  attempt?: number;
  costUsdOverride?: number;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function computeCostUsd(input: RecordUsageInput): number {
  if (typeof input.costUsdOverride === "number") return input.costUsdOverride;
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const cacheCreationInputTokens = input.cacheCreationInputTokens ?? 0;

  if (input.provider === "anthropic") {
    return computeAnthropicCostUsd(
      input.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cacheCreationInputTokens,
      input.webSearchRequests ?? 0,
    );
  }
  if (input.provider === "perplexity") {
    return computePerplexityCostUsd(
      input.model,
      inputTokens,
      outputTokens,
      input.requestCount ?? 1,
    );
  }
  if (input.provider === "xai" && input.stage === "tts") {
    return computeXaiTtsCostUsd(input.ttsCharacters ?? 0);
  }
  return 0;
}

/**
 * Insert one row in `provider_usage_events`. Failures are swallowed and logged
 * to console — telemetry must never break the generation pipeline.
 *
 * Call this immediately after a provider responds, BEFORE any parsing /
 * validation / upload work that might throw. The provider has already charged
 * us by the time the response is in our hands; the row needs to exist
 * regardless of what happens downstream.
 */
export async function recordProviderUsage(input: RecordUsageInput): Promise<void> {
  try {
    const cost_usd = computeCostUsd(input);
    const supabase = serviceClient();
    const { error } = await supabase.from("provider_usage_events").insert({
      generation_id: input.generationId ?? null,
      user_id: input.userId ?? null,
      chapter_idx: input.chapterIdx ?? null,
      stage: input.stage,
      provider: input.provider,
      model: input.model,
      variant: input.variant ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      cached_input_tokens: input.cachedInputTokens ?? null,
      cache_creation_input_tokens: input.cacheCreationInputTokens ?? null,
      tool_calls: input.toolCalls ?? 0,
      web_search_requests: input.webSearchRequests ?? 0,
      tts_characters: input.ttsCharacters ?? null,
      cost_usd,
      duration_ms: input.durationMs ?? null,
      attempt: input.attempt ?? 1,
    });
    if (error) {
      console.error("[provider_usage_events] insert failed", error.message, { stage: input.stage, model: input.model });
    }
  } catch (err) {
    console.error("[provider_usage_events] unexpected error", (err as Error).message);
  }
}
