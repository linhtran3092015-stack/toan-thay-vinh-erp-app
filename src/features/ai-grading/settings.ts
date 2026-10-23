import { z } from "zod";

import { MODEL_LABELS } from "@/features/ai-grading/models";

/**
 * AI grading settings (system_settings keys ai_grading.*), as get_ai_grading_overview returns them
 * with defaults filled in. Only the owner (settings.manage) may change them. SQL twin and
 * validation: ai_grading_settings / update_system_settings in 20261021090000_ai_grading_worker.sql.
 */

export const GRADE_MODEL_OPTIONS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;
export const TIEBREAK_MODEL_OPTIONS = ["claude-sonnet-5-5", "claude-haiku-5-5", "off"] as const;
export const KEY_MODEL_OPTIONS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const;
export const EFFORT_OPTIONS = ["low", "medium", "high"] as const;
export const DAILY_BUDGET_LIMITS = { max: 200, min: 1 } as const;

export const aiGradingSettingsSchema = z.object({
  dailyBudgetUsd: z
    .number()
    .int("Trần chi phí ngày là số nguyên (USD).")
    .min(DAILY_BUDGET_LIMITS.min, `Trần chi phí ngày tối thiểu ${DAILY_BUDGET_LIMITS.min} USD.`)
    .max(DAILY_BUDGET_LIMITS.max, `Trần chi phí ngày tối đa ${DAILY_BUDGET_LIMITS.max} USD.`),
  doubleCheck: z.boolean(),
  enabled: z.boolean(),
  gradeEffort: z.enum(EFFORT_OPTIONS),
  gradeModel: z.enum(GRADE_MODEL_OPTIONS),
  keyModel: z.enum(KEY_MODEL_OPTIONS),
  tiebreakModel: z.enum(TIEBREAK_MODEL_OPTIONS),
});

export type AiGradingSettings = z.infer<typeof aiGradingSettingsSchema>;

export const AI_GRADING_DEFAULTS: AiGradingSettings = {
  dailyBudgetUsd: 20,
  doubleCheck: true,
  enabled: false,
  gradeEffort: "medium",
  gradeModel: "claude-haiku-5-5",
  keyModel: "claude-opus-5-5",
  tiebreakModel: "claude-sonnet-5-5",
};

/** Settings as stored (snake_case jsonb from ai_grading_settings()). */
export const storedAiGradingSettingsSchema = z
  .object({
    daily_budget_usd: z.coerce.number().catch(AI_GRADING_DEFAULTS.dailyBudgetUsd),
    double_check: z.boolean().catch(AI_GRADING_DEFAULTS.doubleCheck),
    enabled: z.boolean().catch(AI_GRADING_DEFAULTS.enabled),
    grade_effort: z.enum(EFFORT_OPTIONS).catch(AI_GRADING_DEFAULTS.gradeEffort),
    grade_model: z.enum(GRADE_MODEL_OPTIONS).catch(AI_GRADING_DEFAULTS.gradeModel),
    key_model: z.enum(KEY_MODEL_OPTIONS).catch(AI_GRADING_DEFAULTS.keyModel),
    tiebreak_model: z.enum(TIEBREAK_MODEL_OPTIONS).catch(AI_GRADING_DEFAULTS.tiebreakModel),
  })
  .transform(
    (stored): AiGradingSettings => ({
      dailyBudgetUsd: stored.daily_budget_usd,
      doubleCheck: stored.double_check,
      enabled: stored.enabled,
      gradeEffort: stored.grade_effort,
      gradeModel: stored.grade_model,
      keyModel: stored.key_model,
      tiebreakModel: stored.tiebreak_model,
    }),
  );

/** update_system_settings payload (booleans are stored as "on"/"off"). */
export function aiGradingSettingsPayload(settings: AiGradingSettings): Record<string, string | number> {
  return {
    "ai_grading.daily_budget_usd": settings.dailyBudgetUsd,
    "ai_grading.double_check": settings.doubleCheck ? "on" : "off",
    "ai_grading.enabled": settings.enabled ? "on" : "off",
    "ai_grading.grade_effort": settings.gradeEffort,
    "ai_grading.grade_model": settings.gradeModel,
    "ai_grading.key_model": settings.keyModel,
    "ai_grading.tiebreak_model": settings.tiebreakModel,
  };
}

export const EFFORT_LABELS: Record<AiGradingSettings["gradeEffort"], string> = {
  high: "Cao (chậm, tốn hơn)",
  low: "Thấp (nhanh, rẻ)",
  medium: "Vừa (đề xuất)",
};

export function modelOptionLabel(value: string): string {
  if (value === "off") return "Không dùng trọng tài";
  return MODEL_LABELS[value as keyof typeof MODEL_LABELS] ?? value;
}

export const PAUSE_REASON_LABELS: Record<string, string> = {
  auth_failed: "Khóa API sai hoặc đã bị thu hồi",
  credit_exhausted: "Hết tín dụng API",
  daily_budget: "Chạm trần chi phí ngày",
  model_unavailable: "Model không dùng được",
  spend_limit: "Chạm trần chi tiêu tháng",
  workspace_limit: "Chạm trần chi tiêu của workspace",
};

export interface DailySpend {
  costUsd: number;
  /** YYYY-MM-DD, Vietnam date. */
  date: string;
  runs: number;
}

export interface AiGradingOverview {
  /** Last 30 days, oldest first (days without runs are 0). */
  dailySpend: DailySpend[];
  failedToday: number;
  gradedToday: number;
  keysReadToday: number;
  pauseReason: string | null;
  pausedUntil: string | null;
  queued: number;
  running: number;
  settings: AiGradingSettings;
  spentMonthUsd: number;
  spentTodayUsd: number;
}

export const overviewSchema = z
  .object({
    daily_spend: z
      .array(z.object({ cost_usd: z.coerce.number().catch(0), date: z.string(), runs: z.coerce.number().catch(0) }))
      .catch([]),
    failed_today: z.coerce.number().catch(0),
    graded_today: z.coerce.number().catch(0),
    keys_read_today: z.coerce.number().catch(0),
    pause_reason: z.string().nullable().catch(null),
    paused_until: z.string().nullable().catch(null),
    queued: z.coerce.number().catch(0),
    running: z.coerce.number().catch(0),
    settings: storedAiGradingSettingsSchema,
    spent_month_usd: z.coerce.number().catch(0),
    spent_today_usd: z.coerce.number().catch(0),
  })
  .transform(
    (row): AiGradingOverview => ({
      dailySpend: row.daily_spend.map((day) => ({ costUsd: day.cost_usd, date: day.date, runs: day.runs })),
      failedToday: row.failed_today,
      gradedToday: row.graded_today,
      keysReadToday: row.keys_read_today,
      pauseReason: row.pause_reason,
      pausedUntil: row.paused_until,
      queued: row.queued,
      running: row.running,
      settings: row.settings,
      spentMonthUsd: row.spent_month_usd,
      spentTodayUsd: row.spent_today_usd,
    }),
  );
