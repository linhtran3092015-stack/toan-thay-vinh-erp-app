"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlClassName, Field } from "@/components/ui/field";
import type { AiGradingActionResult } from "@/features/ai-grading/actions";
import { resumeAiGradingAction, updateAiGradingSettingsAction } from "@/features/ai-grading/actions";
import {
  DAILY_BUDGET_LIMITS,
  EFFORT_LABELS,
  EFFORT_OPTIONS,
  GRADE_MODEL_OPTIONS,
  KEY_MODEL_OPTIONS,
  modelOptionLabel,
  PAUSE_REASON_LABELS,
  TIEBREAK_MODEL_OPTIONS,
  type AiGradingOverview,
  type AiGradingSettings,
} from "@/features/ai-grading/settings";
import { useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { formatDateTime } from "@/lib/datetime";

const LABELS: Record<keyof AiGradingSettings, string> = {
  dailyBudgetUsd: "Trần chi phí ngày",
  doubleCheck: "Chấm hai lần",
  enabled: "Bật chấm bài AI",
  gradeEffort: "Mức suy luận khi chấm",
  gradeModel: "Model chấm bài",
  keyModel: "Model đọc đề",
  tiebreakModel: "Model trọng tài",
};

function usd(value: number): string {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;
}

export interface AiGradingSettingsActions {
  resume: () => Promise<AiGradingActionResult>;
  save: (settings: AiGradingSettings) => Promise<AiGradingActionResult>;
}

const DEFAULT_ACTIONS: AiGradingSettingsActions = { resume: resumeAiGradingAction, save: updateAiGradingSettingsAction };

/**
 * Cài đặt → Chấm bài AI (phase 3a). Everyone with settings.view sees the status (key configured,
 * pause, spend, queue); only the owner (settings.manage) changes models, double checking and the
 * daily budget. Approval rules, comment phrases and the bonus come with phase 3b/3c.
 */
export function AiGradingSettingsPanel({
  actions = DEFAULT_ACTIONS,
  apiKeyConfigured,
  canManage,
  cronConfigured,
  overview,
}: {
  actions?: AiGradingSettingsActions;
  apiKeyConfigured: boolean;
  canManage: boolean;
  cronConfigured: boolean;
  overview: AiGradingOverview;
}) {
  const [saved, setSaved] = useState(overview.settings);
  const [values, setValues] = useState(overview.settings);
  const [budgetText, setBudgetText] = useState(String(overview.settings.dailyBudgetUsd));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resumeResult, setResumeResult] = useState<AiGradingActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const budget = Number(budgetText);
  const budgetValid = Number.isInteger(budget) && budget >= DAILY_BUDGET_LIMITS.min && budget <= DAILY_BUDGET_LIMITS.max;
  const current: AiGradingSettings = { ...values, dailyBudgetUsd: budgetValid ? budget : saved.dailyBudgetUsd };
  const changed = (Object.keys(LABELS) as Array<keyof AiGradingSettings>)
    .filter((key) => (key === "dailyBudgetUsd" ? budgetText !== String(saved.dailyBudgetUsd) : values[key] !== saved[key]))
    .map((key) => LABELS[key]);

  const set = <K extends keyof AiGradingSettings>(key: K, value: AiGradingSettings[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setMessage("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!budgetValid) return;
    const submitted = current;
    setMessage("");
    setError(null);
    startTransition(async () => {
      let result: AiGradingActionResult;
      try {
        result = await actions.save(submitted);
      } catch {
        result = { message: "Không thể kết nối hệ thống cài đặt.", ok: false };
      }
      if (result.ok) {
        setSaved(submitted);
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const onCancel = () => {
    if (pending) return;
    setValues(saved);
    setBudgetText(String(saved.dailyBudgetUsd));
    setError(null);
    setMessage("");
  };
  useLeaveGuard(canManage && changed.length > 0 && !pending, onCancel);
  useSaveInFlightGuard(pending);

  const resume = () => {
    setResumeResult(null);
    startTransition(async () => {
      try {
        setResumeResult(await actions.resume());
      } catch {
        setResumeResult({ message: "Không thể kết nối hệ thống cài đặt.", ok: false });
      }
    });
  };

  const disabled = !canManage || pending;
  const paused = overview.pausedUntil !== null;

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      {!canManage ? (
        <p className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
          <Badge>Chỉ đọc</Badge>
          Chỉ chủ trung tâm (quyền settings.manage) sửa được cài đặt chấm bài AI.
        </p>
      ) : null}

      <SettingsCard description="Hôm nay theo giờ Việt Nam; chi phí là ước tính theo giá niêm yết của Claude API." title="Tình trạng">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={apiKeyConfigured ? "success" : "warning"}>{apiKeyConfigured ? "Đã có khóa Claude API" : "Chưa có ANTHROPIC_API_KEY trên máy chủ"}</Badge>
            <Badge tone={saved.enabled ? "success" : "neutral"}>{saved.enabled ? "Đang bật" : "Đang tắt"}</Badge>
            <Badge tone={cronConfigured ? "success" : "neutral"}>{cronConfigured ? "Có lịch chạy dự phòng (CRON_SECRET)" : "Chưa có CRON_SECRET: chỉ chạy khi có việc"}</Badge>
          </div>
          {paused ? (
            <ResultBanner
              description={`${PAUSE_REASON_LABELS[overview.pauseReason ?? ""] ?? overview.pauseReason ?? "Không rõ lý do"}. Tự chạy lại lúc ${formatDateTime(overview.pausedUntil!)}; trong lúc chờ, trợ giảng chấm tay.`}
              title="Chấm bài AI đang tạm dừng"
              tone="warning"
            />
          ) : null}
          {paused && canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={pending} onClick={resume} variant="secondary">
                Chạy lại ngay
              </Button>
              <span className="text-caption text-text-muted">Chỉ bấm sau khi đã xử lý nguyên nhân (nạp tín dụng, sửa khóa, nâng trần).</span>
            </div>
          ) : null}
          {resumeResult ? <ResultBanner title={resumeResult.message} tone={resumeResult.ok ? "success" : "error"} /> : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-secondary sm:grid-cols-4">
            <Stat label="Chi phí hôm nay">
              {usd(overview.spentTodayUsd)} / {usd(saved.dailyBudgetUsd)}
            </Stat>
            <Stat label="Chi phí tháng này">{usd(overview.spentMonthUsd)}</Stat>
            <Stat label="Bài AI chấm hôm nay">{overview.gradedToday}</Stat>
            <Stat label="Đề AI đọc hôm nay">{overview.keysReadToday}</Stat>
            <Stat label="Đang chờ">{overview.queued}</Stat>
            <Stat label="Đang chạy">{overview.running}</Stat>
            <Stat label="Lỗi hôm nay">{overview.failedToday}</Stat>
          </dl>
        </div>
      </SettingsCard>

      <div className="grid gap-5 md:grid-cols-2">
        <SettingsCard
          description="AI chấm từng bài khi đề của buổi đã chốt đáp án. Điểm do phần mềm cộng từ kết quả từng câu; trợ giảng vẫn xem và duyệt."
          title="Chấm bài"
        >
          <div className="grid gap-4">
            <Toggle checked={values.enabled} disabled={disabled} onChange={(checked) => set("enabled", checked)}>
              {LABELS.enabled}
            </Toggle>
            <Field hint="Thử Lớp 3 ngày 21/10: Haiku 5.5 chấm đúng 11/11 bài, khoảng 0,001 USD/bài; Sonnet 5.5 khoảng 0,015 USD/bài." label={LABELS.gradeModel}>
              {(props) => (
                <select className={controlClassName} disabled={disabled} onChange={(event) => set("gradeModel", event.target.value as AiGradingSettings["gradeModel"])} value={values.gradeModel} {...props}>
                  {GRADE_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {modelOptionLabel(option)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field hint="Mức cao suy nghĩ lâu hơn và tốn token ra hơn." label={LABELS.gradeEffort}>
              {(props) => (
                <select className={controlClassName} disabled={disabled} onChange={(event) => set("gradeEffort", event.target.value as AiGradingSettings["gradeEffort"])} value={values.gradeEffort} {...props}>
                  {EFFORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {EFFORT_LABELS[option]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Toggle checked={values.doubleCheck} disabled={disabled} onChange={(checked) => set("doubleCheck", checked)}>
              {LABELS.doubleCheck}: hai lần khớp từng câu thì bài “xanh”; lệch thì hỏi trọng tài.
            </Toggle>
            <Field hint="Chỉ dùng khi hai lần chấm lệch nhau (thường dưới 15% số bài)." label={LABELS.tiebreakModel}>
              {(props) => (
                <select
                  className={controlClassName}
                  disabled={disabled || !values.doubleCheck}
                  onChange={(event) => set("tiebreakModel", event.target.value as AiGradingSettings["tiebreakModel"])}
                  value={values.tiebreakModel}
                  {...props}
                >
                  {TIEBREAK_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {modelOptionLabel(option)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </SettingsCard>

        <div className="grid content-start gap-5">
          <SettingsCard description="Đọc ảnh đề và soạn bản nháp đáp án để trợ giảng kiểm tra và chốt." title="Đọc đề">
            <Field hint="Opus 5.5 đọc đúng 5/5 câu của đề Lớp 3, khoảng 0,04 USD/trang." label={LABELS.keyModel}>
              {(props) => (
                <select className={controlClassName} disabled={disabled} onChange={(event) => set("keyModel", event.target.value as AiGradingSettings["keyModel"])} value={values.keyModel} {...props}>
                  {KEY_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {modelOptionLabel(option)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </SettingsCard>

          <SettingsCard description="Chạm trần thì hàng đợi dừng tới 0 giờ hôm sau và báo owner. Workspace ai-grading còn trần tháng riêng trên Claude Console." title="Chi phí">
            <Field
              error={budgetValid ? undefined : `Nhập số nguyên từ ${DAILY_BUDGET_LIMITS.min} đến ${DAILY_BUDGET_LIMITS.max}.`}
              hint="USD mỗi ngày. Ngày thường ước khoảng 1–6 USD."
              label={LABELS.dailyBudgetUsd}
            >
              {(props) => (
                <input
                  className={controlClassName}
                  disabled={disabled}
                  inputMode="numeric"
                  max={DAILY_BUDGET_LIMITS.max}
                  min={DAILY_BUDGET_LIMITS.min}
                  onChange={(event) => {
                    setBudgetText(event.target.value);
                    setMessage("");
                  }}
                  step={1}
                  type="number"
                  value={budgetText}
                  {...props}
                />
              )}
            </Field>
          </SettingsCard>
        </div>
      </div>

      {canManage ? (
        <StickySaveBar
          changedLabels={changed}
          dirtyCount={changed.length}
          error={error ? <ResultBanner description={error} title="Chưa lưu được cài đặt." tone="danger" /> : null}
          isSaving={pending}
          onCancel={onCancel}
          saveDisabled={changed.length === 0 || !budgetValid}
          saveDisabledReason={budgetValid ? undefined : "Trần chi phí ngày chưa hợp lệ."}
          saveLabel="Lưu cài đặt"
          saveType="submit"
          savingLabel="Đang lưu…"
          statusMessage={message}
        />
      ) : null}
    </form>
  );
}

function Stat({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="font-semibold text-text-strong">{children}</dd>
    </div>
  );
}

function Toggle({
  checked,
  children,
  disabled,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-2 text-secondary text-text-strong md:min-h-8">
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--action-primary)]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{children}</span>
    </label>
  );
}
