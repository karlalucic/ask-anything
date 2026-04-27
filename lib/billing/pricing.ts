// Cost rates per 1 million tokens (or per character for TTS, per request for search).
// Treat these as "best estimate at time of writing" — verify against current
// provider docs at implementation time. The cost dashboard surfaces these
// numbers; if they drift, update here and re-run baselines.

export interface AnthropicRate {
  input: number;          // $/M tokens, NON-cached input only
  output: number;         // $/M tokens
  cachedRead?: number;    // $/M tokens read from cache (~10% of input typically)
  cacheCreation?: number; // $/M tokens written to cache (~125% of input typically)
}

export interface PerplexityRate {
  input: number;          // $/M tokens
  output: number;         // $/M tokens
  perRequestUsd: number;  // flat fee per call
}

const ANTHROPIC_RATES: Record<string, AnthropicRate> = {
  // Sonnet 4.6
  "claude-sonnet-4-6": { input: 3, output: 15, cachedRead: 0.3, cacheCreation: 3.75 },
  "claude-sonnet-4-6-20250514": { input: 3, output: 15, cachedRead: 0.3, cacheCreation: 3.75 },
  // Opus 4.7 — current Anthropic pricing per Codex review
  "claude-opus-4-7": { input: 5, output: 25, cachedRead: 0.5, cacheCreation: 6.25 },
  // Haiku 4.5
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cachedRead: 0.1, cacheCreation: 1.25 },
};

const PERPLEXITY_RATES: Record<string, PerplexityRate> = {
  // Per Perplexity public pricing (verify at implementation time):
  // sonar: $1/M input, $1/M output, ~$0.005/request flat fee
  sonar: { input: 1, output: 1, perRequestUsd: 0.005 },
  // sonar-pro: $3/M input, $15/M output, ~$0.005/request (high-context tier)
  "sonar-pro": { input: 3, output: 15, perRequestUsd: 0.005 },
};

// xAI TTS: $4.20 per 1M characters (per user-confirmed pricing).
const XAI_TTS_PER_CHAR_USD = 4.2 / 1_000_000;

// Anthropic web_search_20250305 tool: $10 per 1,000 search requests.
const ANTHROPIC_WEB_SEARCH_PER_REQUEST_USD = 10 / 1000;

/**
 * Compute Anthropic cost. Per Anthropic docs, the `input_tokens` field on the
 * response represents the NON-cached portion of input — `cache_read_input_tokens`
 * and `cache_creation_input_tokens` are reported separately. Do NOT subtract
 * cached counts from `input_tokens` again.
 *
 * @param webSearchRequests count of paid web search calls (from `usage.server_tool_use.web_search_requests`)
 */
export function computeAnthropicCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  cacheCreationInputTokens = 0,
  webSearchRequests = 0,
): number {
  const rate = ANTHROPIC_RATES[model];
  if (!rate) return 0;
  const tokensCost =
    (inputTokens * rate.input
      + outputTokens * rate.output
      + cachedInputTokens * (rate.cachedRead ?? rate.input)
      + cacheCreationInputTokens * (rate.cacheCreation ?? rate.input))
    / 1_000_000;
  const searchCost = webSearchRequests * ANTHROPIC_WEB_SEARCH_PER_REQUEST_USD;
  return tokensCost + searchCost;
}

export function computePerplexityCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  requestCount = 1,
): number {
  const rate = PERPLEXITY_RATES[model];
  if (!rate) return 0;
  const tokensCost = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
  const requestCost = requestCount * rate.perRequestUsd;
  return tokensCost + requestCost;
}

export function computeXaiTtsCostUsd(characters: number): number {
  return characters * XAI_TTS_PER_CHAR_USD;
}
