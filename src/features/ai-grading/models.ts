/**
 * Claude models the AI grading worker may call, with list prices used for the cost estimate that
 * feeds the daily budget (plan §5.2). Prices are USD per million tokens at standard (non-batch)
 * rates; cache reads cost 10% of input and 5-minute cache writes 125%.
 */

export const CLAUDE_MODELS = {
  haiku: "claude-haiku-5-5",
  opus: "claude-opus-5-5",
  sonnet: "claude-sonnet-5-5",
} as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

export const MODEL_LABELS: Record<ClaudeModelId, string> = {
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
};

const PRICES_PER_MTOK: Record<ClaudeModelId, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

export interface TokenUsage {
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  input_tokens: number;
  output_tokens: number;
}

export function isClaudeModelId(value: unknown): value is ClaudeModelId {
  return typeof value === "string" && value in PRICES_PER_MTOK;
}

/** Estimated USD for one call. Unknown models (e.g. a server-side fallback) are priced as Opus. */
export function estimateCostUsd(model: string | null | undefined, usage: TokenUsage | null | undefined): number {
  if (!usage) return 0;
  const price = isClaudeModelId(model) ? PRICES_PER_MTOK[model] : PRICES_PER_MTOK["claude-opus-5-5"];
  const tokens =
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    (usage.cache_read_input_tokens ?? 0) * price.input * 0.1 +
    (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25;
  return tokens / 1_000_000;
}
