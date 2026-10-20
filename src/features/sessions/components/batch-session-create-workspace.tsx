"use client";

import { ArrowLeft, ChevronDown, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type InputHTMLAttributes,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { FormSection } from "@/components/patterns/form-with-toc";
import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { addDays, formatIsoDate, getVietnamToday } from "@/lib/datetime";
import { formatLearningMode } from "@/lib/format";
import { cn } from "@/lib/utils";

import { type BatchSessionActionResult, createBatchSessionsAction } from "../actions/session-batch-actions";
import {
  type BatchCalculationParams,
  type BatchCalculationSlot,
  type BatchClassOption,
  type BatchScheduleOption,
  type ExistingSessionSnapshot,
  calculateBatchOccurrences,
  VIETNAMESE_SHORT_WEEKDAYS,
  VIETNAMESE_WEEKDAY_NAMES,
} from "../batch-calculation";
import {
  addBatchHoliday,
  type BatchPreviewRow,
  buildBatchPreviewRows,
  getBatchCreateBlockReason,
  getBatchDraftRowStatus,
  getBatchSessionKindLabel,
  getSelectedBatchDrafts,
  isSameBatchPreviewRow,
  removeBatchHoliday,
  summarizeBatchPreview,
  toggleAllChoosableDrafts,
} from "../batch-preview-models";
import { type BatchSessionDraftItem, isValidDateString } from "../forms/session-batch-schema";
import type { SessionLearningMode } from "../read-models";
import type { SessionBatchActionOverrides } from "../session-batch-action-overrides";
import { BatchPreviewGrid } from "./batch-preview-grid";

/** Form values a preview or test may start from; the route passes none (today's defaults). */
export interface BatchWorkspaceInitialSettings {
  endDate?: string;
  holidays?: readonly string[];
  rangeMode?: "count" | "date_range";
  selectedTemplateIds?: readonly string[];
  sessionCount?: number;
  startDate?: string;
  strategy?: "template" | "custom";
}

interface BatchSessionCreateWorkspaceProps {
  classes: BatchClassOption[];
  schedules: BatchScheduleOption[];
  existingSessions: ExistingSessionSnapshot[];
  existingSessionCount: number;
  selectedClassId: string;
  directoryQuery?: string;
  /**
   * Vietnam business date `YYYY-MM-DD` (the route passes getVietnamToday()); falls back to the
   * browser's Vietnam date. It seeds the dates and flags past rows; it is not a calculation input,
   * so the first refresh after midnight keeps the drafts.
   */
  today?: string;
  /** /dev preview seam: replaces the real server action. */
  actions?: SessionBatchActionOverrides;
  /** /dev preview seam: switches class without navigating (default: replace to /sessions/batch?classId=…). */
  onClassChange?: (classId: string) => void;
  /** /dev preview and test seeding of the form. */
  initialSettings?: BatchWorkspaceInitialSettings;
}

const LEARNING_MODES: readonly SessionLearningMode[] = ["offline", "online", "hybrid"];

/** One segment of a two-option switch (strategy, range mode): 44px touch / 40px desktop. */
const segmentClassName =
  "flex min-h-11 items-center justify-center px-3 text-center text-control transition-colors md:min-h-10";
const segmentSelectedClassName = "bg-surface-selected font-semibold text-action-primary";
const segmentIdleClassName = "bg-surface-base text-text-default hover:bg-interactive-hover";
const insetFocusClassName = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus";

/** Inputs inside the per-session table: 44px on touch, 36px from md. */
const rowInputClassName =
  "h-11 rounded-sm border border-border-subtle bg-field-bg px-2 text-control text-text-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus md:h-9";

/** Touch height of a 40px (md) or 32px (sm) Button below md; desktop sizes stay. */
const touchButtonClassName = "max-md:h-11";

/** A text link inside a result banner: a 44px target below md, inline text from md. */
const bannerLinkClassName = "inline-flex min-h-11 items-center md:min-h-0";

/** A `?classId=` that is not one of the active classes the loader lists (a draft or closed class, an unknown id). */
const UNAVAILABLE_CLASS_COPY = {
  description:
    "Lớp được chọn chưa kích hoạt, đã đóng hoặc không tồn tại. Chỉ lớp đang hoạt động mới tạo được buổi học hàng loạt: hãy chọn một lớp trong danh sách.",
  placeholder: "Chọn một lớp đang hoạt động",
  reason: "Chọn một lớp đang hoạt động để tạo buổi học.",
  title: "Lớp này không tạo buổi hàng loạt được",
} as const;

type DraftEdits = Partial<Pick<BatchSessionDraftItem, "startTime" | "endTime" | "notes">>;

/**
 * What the draft calculation reads, as plain data; its JSON is the signature
 * the drafts are recalculated on. Existing sessions, today, holidays and the
 * templates' effective windows are not part of it: they only decide which
 * rows are flagged or blocked, and buildBatchPreviewRows applies them afresh
 * on every render.
 */
interface BatchDraftCalculationInput {
  classId: string;
  params: Omit<BatchCalculationParams, "existingSessions" | "today">;
}

/**
 * Every draft starts ticked: no existing session is passed, so a draft is
 * never stored unticked for a conflict that may clear later (a time edit, a
 * cancelled session); the rows block duplicates against the current list.
 */
function calculateDrafts(input: BatchDraftCalculationInput | null): BatchSessionDraftItem[] {
  return input ? calculateBatchOccurrences({ ...input.params, existingSessions: [] }) : [];
}

/** Code-unit order (the same on the server and in every browser locale). */
function compareById(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** A typed whole number ≥ 1, or null while the field is empty or holds anything else. */
function readPositiveInteger(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isInteger(value) && value >= 1 ? value : null;
}

type PositiveIntegerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onBlur" | "onChange" | "type" | "value"> & {
  onCommit: (value: number) => void;
  value: number;
};

/**
 * A whole-number field (≥ 1) that can be emptied while typing, so a phone's
 * backspace then "8" reads 8, not 18. A keystroke that reads as a whole
 * number ≥ 1 is committed at once (the preview follows it); while the field is
 * empty the preview keeps the last committed number; blur commits what the
 * field holds, an empty or invalid field as 1.
 */
function PositiveIntegerInput({ onCommit, value, ...props }: PositiveIntegerInputProps) {
  // What the user typed since the last blur; null shows the committed value.
  const [text, setText] = useState<string | null>(null);
  return (
    <Input
      {...props}
      inputMode="numeric"
      min={1}
      onBlur={() => {
        if (text === null) return;
        onCommit(readPositiveInteger(text) ?? 1);
        setText(null);
      }}
      onChange={(event) => {
        setText(event.target.value);
        const typed = readPositiveInteger(event.target.value);
        if (typed !== null) onCommit(typed);
      }}
      type="number"
      value={text ?? String(value)}
    />
  );
}

/**
 * /sessions/batch (design 17b, right panel): class and recurrence rule,
 * range, client-only holidays, then the chip preview whose chips are the
 * per-session checkboxes, and one primary that opens the confirmation. The
 * request carries only the ticked choosable sessions (at most 100); the
 * created count shown afterwards is the server's own message.
 */
export function BatchSessionCreateWorkspace({
  classes,
  schedules,
  existingSessions,
  existingSessionCount,
  selectedClassId,
  directoryQuery = "",
  today,
  actions,
  onClassChange,
  initialSettings,
}: BatchSessionCreateWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const baseId = useId();
  const createBatchSessions = actions?.createBatchSessions ?? createBatchSessionsAction;
  const sessionsHref = directoryQuery ? `/sessions?${directoryQuery}` : "/sessions";

  // Vietnam business date: the route's value, else the browser's, read once per mount.
  const [fallbackToday] = useState(getVietnamToday);
  const todayStr = today ?? fallbackToday;

  // 1. Current selected class: the one the page names, or the first active class when it names
  // none. A named class that is not active (draft, closed, unknown, or closed since the page
  // loaded) selects nothing: the schedules, existing sessions and count are that class's, so a
  // fallback to another class would write its batch from the wrong class's data.
  const selectedClass = useMemo(
    () => (selectedClassId ? classes.find((c) => c.id === selectedClassId) : classes[0]) ?? null,
    [classes, selectedClassId],
  );

  // 2. Generation Strategy
  const [strategy, setStrategy] = useState<"template" | "custom">(
    initialSettings?.strategy ?? (schedules.length > 0 ? "template" : "custom"),
  );

  // Selected schedule templates (default all active)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(() =>
    initialSettings?.selectedTemplateIds ? [...initialSettings.selectedTemplateIds] : schedules.map((s) => s.id),
  );

  // Custom recurrence slots
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([1, 4]); // Mon & Thu
  const [customStartTime, setCustomStartTime] = useState("18:00");
  const [customEndTime, setCustomEndTime] = useState("19:30");
  const [customLearningMode, setCustomLearningMode] = useState<SessionLearningMode>(
    selectedClass?.defaultLearningMode ?? "offline",
  );
  const [customRoomName, setCustomRoomName] = useState("");
  const [customMeetingUrl, setCustomMeetingUrl] = useState("");
  const [customComponentCode, setCustomComponentCode] = useState("");

  // 3. Horizon / Range configuration
  const [rangeMode, setRangeMode] = useState<"count" | "date_range">(initialSettings?.rangeMode ?? "count");
  const [sessionCount, setSessionCount] = useState(initialSettings?.sessionCount ?? 10);
  const [startDate, setStartDate] = useState(() => initialSettings?.startDate ?? todayStr);
  const [endDate, setEndDate] = useState(() => initialSettings?.endDate ?? addDays(todayStr, 60));

  // Holidays: client-only, they only untick sessions of this batch.
  const [holidays, setHolidays] = useState<string[]>(() =>
    (initialSettings?.holidays ?? []).reduce<string[]>((list, date) => addBatchHoliday(list, date), []),
  );
  const [holidayInput, setHolidayInput] = useState("");
  const canAddHoliday = isValidDateString(holidayInput) && !holidays.includes(holidayInput);

  // 4. Naming pattern & Start number. "Số bắt đầu" is the class's session count + 1, read once at
  // mount (the route and the /dev preview key the workspace by class, so a class switch remounts
  // it), and a number the user types replaces it. It is in the calculation signature, so no refresh
  // moves it, this page's own create included: a new count would recalculate the drafts and wipe
  // the user's ticks, edits and removals. The sessions just created come back in the refreshed
  // existing list, and the rows mark them "đã có (bỏ qua)".
  const [namingPattern, setNamingPattern] = useState("Buổi {n}");
  const [startNumber, setStartNumber] = useState(existingSessionCount + 1);

  // Handle class switch
  const handleClassChange = (newId: string) => {
    if (onClassChange) {
      onClassChange(newId);
      return;
    }
    const query = directoryQuery ? `?classId=${newId}&${directoryQuery}` : `?classId=${newId}`;
    router.replace(`/sessions/batch${query}`);
  };

  // 5. The calculation's own inputs, as plain data.
  const selectedClassKey = selectedClass?.id ?? null;
  const calculationInput = useMemo<BatchDraftCalculationInput | null>(() => {
    if (!selectedClassKey) return null;

    const slots: BatchCalculationSlot[] =
      strategy === "template"
        ? schedules
            .filter((s) => selectedTemplateIds.includes(s.id))
            // By id: the loader's order of templates tied on (weekday, start time) is not fixed,
            // and the calculation keeps the given order among ties (session numbers, signature).
            .sort(compareById)
            .map((t) => ({
              scheduleTemplateId: t.id,
              weekday: t.weekday,
              startTime: t.startTime,
              endTime: t.endTime,
              learningMode: t.learningMode,
              roomName: t.roomName,
              meetingUrl: t.meetingUrl,
              componentCode: t.componentCode,
            }))
        : customWeekdays.map((w) => ({
            weekday: w,
            startTime: customStartTime,
            endTime: customEndTime,
            learningMode: customLearningMode,
            roomName: customRoomName || null,
            meetingUrl: customMeetingUrl || null,
            componentCode: customComponentCode || null,
          }));

    return {
      classId: selectedClassKey,
      params: {
        startDate,
        endDate: rangeMode === "date_range" ? endDate : undefined,
        rangeMode,
        count: sessionCount,
        slots,
        namingPattern,
        startNumber,
      },
    };
  }, [
    selectedClassKey,
    strategy,
    schedules,
    selectedTemplateIds,
    customWeekdays,
    customStartTime,
    customEndTime,
    customLearningMode,
    customRoomName,
    customMeetingUrl,
    customComponentCode,
    rangeMode,
    startDate,
    endDate,
    sessionCount,
    namingPattern,
    startNumber,
  ]);
  const calculationSignature = useMemo(() => JSON.stringify(calculationInput), [calculationInput]);

  // Working state for drafts (allows manual checkboxes, inline edits, removal)
  const [draftSessions, setDraftSessions] = useState<BatchSessionDraftItem[]>(() => calculateDrafts(calculationInput));

  // The drafts are recalculated, wiping the per-row ticks, edits and removals, only when the
  // calculation's CONTENT changes. A router.refresh() (the student-care poll every 60 s, a
  // revalidating server action) hands this component freshly deserialized props of equal
  // content, so object identity says nothing here. New existing sessions, a new Vietnam date or a
  // holiday keep the drafts (the rows re-flag them), and so does a new session count (4.); a
  // template whose rule changed, or a start number the user typed, recalculates them.
  const [draftSignature, setDraftSignature] = useState(calculationSignature);
  if (draftSignature !== calculationSignature) {
    setDraftSignature(calculationSignature);
    setDraftSessions(calculateDrafts(calculationInput));
  }

  // Holidays, duplicates (on each draft's current time), past dates and the templates'
  // effective window are applied on top of the drafts, never stored in them.
  const rows = useMemo(
    () => buildBatchPreviewRows(draftSessions, { existingSessions, holidays, schedules, today: todayStr }),
    [draftSessions, existingSessions, holidays, schedules, todayStr],
  );
  const summary = useMemo(() => summarizeBatchPreview(rows, holidays), [rows, holidays]);
  const selectedCount = summary.selected;
  const createBlockReason = selectedClass ? getBatchCreateBlockReason(selectedCount) : UNAVAILABLE_CLASS_COPY.reason;
  const selectedDrafts = getSelectedBatchDrafts(rows);
  const sessionKind = getBatchSessionKindLabel(strategy);

  // Stable handlers: the chips and the editor rows are memoized on them.
  const handleToggleSelect = useCallback((id: string) => {
    setDraftSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    );
  }, []);

  const handleToggleAll = () => {
    setDraftSessions(toggleAllChoosableDrafts(draftSessions, rows));
  };

  const handleDeleteDraft = useCallback((id: string) => {
    setDraftSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Inline update for specific draft
  const handleUpdateDraft = useCallback((id: string, updates: DraftEdits) => {
    setDraftSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }, []);

  const handleAddHoliday = () => {
    if (!canAddHoliday) return;
    setHolidays((prev) => addBatchHoliday(prev, holidayInput));
    setHolidayInput("");
  };

  // Confirmation dialog and submission
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<BatchSessionActionResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // The confirmation closes while its opener may be disabled (still pending, or every session
  // now exists), so the dialog cannot hand focus back to it: the result takes focus instead.
  useEffect(() => {
    if (submitResult) resultRef.current?.focus();
  }, [submitResult]);

  const handleExecuteBatchCreate = () => {
    const chosenSessions = getSelectedBatchDrafts(rows);
    // Defence in depth behind the disabled buttons: only ever for the class the page names.
    if (!selectedClass || (selectedClassId && selectedClass.id !== selectedClassId)) return;
    if (getBatchCreateBlockReason(chosenSessions.length) !== null) return;

    startTransition(async () => {
      try {
        const result = await createBatchSessions({
          classId: selectedClass.id,
          sessions: chosenSessions.map((s) => ({
            sessionDate: s.sessionDate,
            startTime: s.startTime,
            endTime: s.endTime,
            learningMode: s.learningMode,
            sessionKind: s.sessionKind,
            scheduleTemplateId: s.scheduleTemplateId,
            componentCode: s.componentCode,
            roomName: s.roomName,
            meetingUrl: s.meetingUrl,
            notes: s.notes,
          })),
          reason: `Tạo hàng loạt ${chosenSessions.length} buổi học cho lớp ${selectedClass.code}`,
        });

        setSubmitResult(result);
        setIsConfirmOpen(false);

        if (result.status === "success") {
          router.refresh();
        }
      } catch {
        setSubmitResult({
          status: "error",
          message: "Lỗi kết nối khi gửi yêu cầu tạo buổi học.",
        });
        setIsConfirmOpen(false);
      }
    });
  };

  const strategyLabelId = `${baseId}-strategy`;
  const weekdaysLabelId = `${baseId}-weekdays`;
  const holidayInputId = `${baseId}-holiday`;
  const holidayHintId = `${baseId}-holiday-hint`;
  const dialogDescriptionId = `${baseId}-confirm-description`;

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ className: touchButtonClassName, variant: "ghost" })} href={sessionsHref}>
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            Về danh sách buổi học
          </Link>
        }
        title="Tạo buổi học hàng loạt"
      >
        <p className="mt-1 text-secondary text-text-muted">
          Sinh buổi học từ lịch tuần của lớp trong một khoảng ngày; xem trước rồi mới tạo.
        </p>
      </PageHeader>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
        <div className="grid min-w-0 content-start gap-5 lg:max-xl:grid-cols-2 lg:max-xl:items-start">
          <FormSection id="lop-hoc" title="1. Lớp học & Quy tắc lặp">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Field label="Chọn lớp học áp dụng" required>
                  {(control) => (
                    <Select {...control} onChange={(e) => handleClassChange(e.target.value)} value={selectedClass?.id ?? ""}>
                      {/* Shown instead of an active class (React would show the first one), so picking any class navigates. */}
                      {selectedClass ? null : (
                        <option disabled value="">
                          {UNAVAILABLE_CLASS_COPY.placeholder}
                        </option>
                      )}
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.code} — {cls.name} (Khối {cls.grade})
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {selectedClass ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
                    <span>Trình độ {selectedClass.level}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatLearningMode(selectedClass.defaultLearningMode)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-text-strong">
                      Đã có {existingSessionCount} buổi
                    </span>
                  </p>
                ) : null}
              </div>

              {/* No class selected: the rule, range and preview below would show the named class's data. */}
              {selectedClass ? (
                <div className="grid gap-1.5">
                  <p className="text-label font-medium text-text-strong" id={strategyLabelId}>
                    Phương thức sinh lịch
                  </p>
                  <div
                    aria-labelledby={strategyLabelId}
                    className="grid grid-cols-2 divide-x divide-border-strong overflow-hidden rounded-md border border-border-strong"
                    role="group"
                  >
                    <button
                      aria-pressed={strategy === "template"}
                      className={cn(segmentClassName, insetFocusClassName, strategy === "template" ? segmentSelectedClassName : segmentIdleClassName)}
                      onClick={() => setStrategy("template")}
                      type="button"
                    >
                      Theo lịch cố định
                    </button>
                    <button
                      aria-pressed={strategy === "custom"}
                      className={cn(segmentClassName, insetFocusClassName, strategy === "custom" ? segmentSelectedClassName : segmentIdleClassName)}
                      onClick={() => setStrategy("custom")}
                      type="button"
                    >
                      Lịch lặp tùy chỉnh
                    </button>
                  </div>
                  <p className="text-secondary text-text-muted">
                    Loại buổi: <strong className="font-semibold text-text-strong">{sessionKind.kind}</strong> ({sessionKind.detail})
                  </p>
                </div>
              ) : (
                <ResultBanner description={UNAVAILABLE_CLASS_COPY.description} title={UNAVAILABLE_CLASS_COPY.title} tone="warning" />
              )}

              {/* Template strategy content */}
              {selectedClass && strategy === "template" && (
                <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
                  <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
                    <legend className="mb-2 p-0 text-caption font-semibold text-text-muted">
                      Lịch học cố định đang có của lớp
                    </legend>
                    {schedules.length === 0 ? (
                      <p className="py-2 text-center text-caption text-warning-ink">
                        Lớp chưa có lịch học cố định nào đang hiệu lực. Hãy chọn &quot;Lịch lặp tùy chỉnh&quot;.
                      </p>
                    ) : (
                      schedules.map((sch) => {
                        const isChecked = selectedTemplateIds.includes(sch.id);
                        return (
                          <label
                            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border-subtle bg-surface-base p-2.5 hover:bg-interactive-hover"
                            key={sch.id}
                          >
                            <input
                              checked={isChecked}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                              onChange={() => {
                                setSelectedTemplateIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== sch.id) : [...prev, sch.id],
                                );
                              }}
                              type="checkbox"
                            />
                            <span className="min-w-0 text-caption">
                              <span className="block font-semibold tabular-nums text-text-strong">
                                {VIETNAMESE_WEEKDAY_NAMES[sch.weekday]}: {sch.startTime.slice(0, 5)} – {sch.endTime.slice(0, 5)}
                              </span>
                              <span className="block text-text-muted">
                                {formatLearningMode(sch.learningMode)}
                                {sch.roomName ? ` · ${sch.roomName}` : ""}
                                {sch.componentCode ? ` · ${sch.componentCode}` : ""}
                                {` · hiệu lực từ ${formatIsoDate(sch.effectiveFrom)}`}
                                {sch.effectiveTo ? ` đến ${formatIsoDate(sch.effectiveTo)}` : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </fieldset>
                </div>
              )}

              {/* Custom recurrence strategy content */}
              {selectedClass && strategy === "custom" && (
                <div className="grid gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3">
                  <div className="grid gap-1.5">
                    <p className="text-label font-medium text-text-strong" id={weekdaysLabelId}>
                      Chọn các ngày học trong tuần
                    </p>
                    <div aria-labelledby={weekdaysLabelId} className="flex flex-wrap gap-1.5" role="group">
                      {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                        const isSelected = customWeekdays.includes(wd);
                        return (
                          <button
                            aria-pressed={isSelected}
                            className={cn(
                              "flex h-11 w-11 items-center justify-center rounded-md border text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:h-10",
                              // The quick counts' pressed look (the solid fill is the page's one primary):
                              // weight, border and tint say which days are on, not hue alone.
                              isSelected
                                ? "border-action-primary bg-surface-selected font-semibold text-action-primary"
                                : "border-border-strong bg-surface-base font-normal text-text-default hover:bg-interactive-hover",
                            )}
                            key={wd}
                            onClick={() => {
                              setCustomWeekdays((prev) =>
                                isSelected ? prev.filter((d) => d !== wd) : [...prev, wd].sort(),
                              );
                            }}
                            type="button"
                          >
                            {VIETNAMESE_SHORT_WEEKDAYS[wd]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 items-end gap-3">
                    <Field label="Giờ bắt đầu">
                      {(control) => (
                        <Input {...control} className="tabular-nums" onChange={(e) => setCustomStartTime(e.target.value)} type="time" value={customStartTime} />
                      )}
                    </Field>
                    <Field label="Giờ kết thúc">
                      {(control) => (
                        <Input {...control} className="tabular-nums" onChange={(e) => setCustomEndTime(e.target.value)} type="time" value={customEndTime} />
                      )}
                    </Field>
                  </div>

                  <div className="grid items-end gap-3 sm:grid-cols-2">
                    <Field label="Hình thức">
                      {(control) => (
                        <Select
                          {...control}
                          onChange={(e) => setCustomLearningMode(e.target.value as SessionLearningMode)}
                          value={customLearningMode}
                        >
                          {LEARNING_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {formatLearningMode(mode)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="Phòng học">
                      {(control) => (
                        <Input {...control} onChange={(e) => setCustomRoomName(e.target.value)} placeholder="VD: Phòng 101" type="text" value={customRoomName} />
                      )}
                    </Field>
                  </div>

                  <div className="grid items-end gap-3 sm:grid-cols-2">
                    <Field label="Link phòng (ClassIn / Meet)">
                      {(control) => (
                        <Input {...control} onChange={(e) => setCustomMeetingUrl(e.target.value)} placeholder="https://..." type="url" value={customMeetingUrl} />
                      )}
                    </Field>
                    <Field label="Mã thành phần">
                      {(control) => (
                        <Input
                          {...control}
                          onChange={(e) => setCustomComponentCode(e.target.value.toUpperCase())}
                          placeholder="VD: DS, HH..."
                          type="text"
                          value={customComponentCode}
                        />
                      )}
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </FormSection>

          {selectedClass ? (
            <FormSection id="pham-vi" title="2. Phạm vi & Tên buổi học">
              <div className="grid gap-4">
                <fieldset className="m-0 grid min-w-0 gap-1.5 border-0 p-0">
                  <legend className="mb-1.5 p-0 text-label font-medium text-text-strong">Cách xác định số lượng</legend>
                  <div className="grid grid-cols-2 divide-x divide-border-strong overflow-hidden rounded-md border border-border-strong">
                    {(
                      [
                        ["count", "Theo số buổi (ClassIn)"],
                        ["date_range", "Theo khoảng ngày"],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        className={cn(
                          segmentClassName,
                          "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-border-focus",
                          rangeMode === value ? segmentSelectedClassName : segmentIdleClassName,
                        )}
                        key={value}
                      >
                        <input
                          checked={rangeMode === value}
                          className="sr-only"
                          name={`${baseId}-range-mode`}
                          onChange={() => setRangeMode(value)}
                          type="radio"
                          value={value}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Field label="Bắt đầu từ ngày" required>
                  {(control) => (
                    <Input {...control} className="tabular-nums" onChange={(e) => setStartDate(e.target.value)} type="date" value={startDate} />
                  )}
                </Field>

                {rangeMode === "count" ? (
                  <div className="grid gap-2">
                    <Field label="Số buổi học cần tạo">
                      {(control) => (
                        <div className="flex items-center gap-2">
                          <PositiveIntegerInput
                            {...control}
                            className="tabular-nums"
                            max={60}
                            onCommit={setSessionCount}
                            value={sessionCount}
                          />
                          <span className="shrink-0 text-secondary text-text-muted">buổi học</span>
                        </div>
                      )}
                    </Field>
                    <div aria-label="Chọn nhanh số buổi" className="flex flex-wrap gap-1.5" role="group">
                      {[5, 10, 15, 20, 24].map((num) => (
                        <button
                          aria-pressed={sessionCount === num}
                          className={cn(
                            "inline-flex h-11 items-center rounded-md border px-3 text-secondary tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:h-8",
                            sessionCount === num
                              ? "border-action-primary bg-surface-selected font-semibold text-action-primary"
                              : "border-border-strong bg-surface-base font-medium text-text-default hover:bg-interactive-hover",
                          )}
                          key={num}
                          onClick={() => setSessionCount(num)}
                          type="button"
                        >
                          {num} buổi
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Field label="Đến hết ngày" required>
                    {(control) => (
                      <Input {...control} className="tabular-nums" onChange={(e) => setEndDate(e.target.value)} type="date" value={endDate} />
                    )}
                  </Field>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor={holidayInputId}>Ngày nghỉ (bỏ qua)</Label>
                  <div className="flex gap-2">
                    <Input
                      aria-describedby={holidayHintId}
                      className="min-w-0 flex-1 tabular-nums"
                      id={holidayInputId}
                      onChange={(e) => setHolidayInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddHoliday();
                        }
                      }}
                      type="date"
                      value={holidayInput}
                    />
                    <Button className={touchButtonClassName} disabled={!canAddHoliday} onClick={handleAddHoliday} variant="secondary">
                      Thêm
                    </Button>
                  </div>
                  <p className="text-caption text-text-muted" id={holidayHintId}>
                    Chỉ dùng để bỏ chọn buổi trong lần tạo này; không lưu vào hệ thống.
                  </p>
                  {holidays.length > 0 ? (
                    <ul aria-label="Ngày nghỉ đã thêm" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {holidays.map((date) => {
                        const hits = summary.holidayHits[date] ?? 0;
                        return (
                          <li
                            className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-neutral-border bg-neutral-bg py-0.5 pl-2.5 pr-0.5 text-caption text-neutral-ink md:min-h-8"
                            key={date}
                          >
                            <span>
                              <span className="font-medium tabular-nums">{formatIsoDate(date)}</span> ·{" "}
                              {hits > 0 ? `bỏ ${hits} buổi` : "không trùng buổi nào"}
                            </span>
                            <button
                              aria-label={`Bỏ ngày nghỉ ${formatIsoDate(date)}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-sm hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus md:h-8 md:w-8"
                              onClick={() => setHolidays((prev) => removeBatchHoliday(prev, date))}
                              type="button"
                            >
                              <X aria-hidden="true" size={14} strokeWidth={2} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>

                {/* Naming Pattern */}
                <div className="grid items-end gap-3 border-t border-border-row pt-4 sm:grid-cols-2">
                  <Field label={`Mẫu tên ({n})`}>
                    {(control) => (
                      <Input {...control} onChange={(e) => setNamingPattern(e.target.value)} placeholder="Buổi {n}" type="text" value={namingPattern} />
                    )}
                  </Field>
                  <Field label="Số bắt đầu">
                    {(control) => (
                      <PositiveIntegerInput
                        {...control}
                        className="tabular-nums"
                        onCommit={setStartNumber}
                        value={startNumber}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </FormSection>
          ) : null}
        </div>

        <div className="grid min-w-0 content-start gap-4">
          {selectedClass ? (
            <FormSection
              description="Bấm vào từng buổi để chọn hoặc bỏ chọn trước khi tạo. Giờ, tên từng buổi sửa trong mục “Chỉnh từng buổi”."
              id="xem-truoc"
              title="3. Bảng xem trước danh sách buổi học"
            >
              <div className="grid gap-4">
                <BatchPreviewGrid onToggle={handleToggleSelect} onToggleAll={handleToggleAll} rows={rows} summary={summary} />
                {rows.length > 0 ? (
                  <BatchDraftEditor onDelete={handleDeleteDraft} onUpdate={handleUpdateDraft} rows={rows} />
                ) : null}
              </div>
            </FormSection>
          ) : null}

          {submitResult ? (
            <div
              className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              ref={resultRef}
              tabIndex={-1}
            >
              <ResultBanner
                action={
                  <Button className={touchButtonClassName} onClick={() => setSubmitResult(null)} size="sm" variant="ghost">
                    Đóng
                  </Button>
                }
                title={submitResult.message}
                tone={submitResult.status === "success" ? "success" : "error"}
              >
                {submitResult.status === "success" ? (
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <Link className={bannerLinkClassName} href={sessionsHref}>
                      Xem danh sách buổi học
                    </Link>
                    {selectedClass ? (
                      <Link className={bannerLinkClassName} href={`/classes/${selectedClass.id}`}>
                        Mở lớp {selectedClass.code}
                      </Link>
                    ) : null}
                  </span>
                ) : null}
              </ResultBanner>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-end gap-2">
            <Link className={getButtonClassName({ className: touchButtonClassName, variant: "secondary" })} href={sessionsHref}>
              Hủy
            </Link>
            <Button
              className={touchButtonClassName}
              disabled={createBlockReason !== null || isPending}
              disabledReason={createBlockReason ?? undefined}
              isLoading={isPending}
              onClick={() => setIsConfirmOpen(true)}
            >
              {isPending ? "Đang tạo…" : `Tạo hàng loạt (${selectedCount} buổi học)`}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabelledBy="confirm-batch-dialog-title"
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!isPending) setIsConfirmOpen(false);
        }}
      >
        <div className="p-6">
          <h2 className="text-section-title font-semibold text-text-strong" id="confirm-batch-dialog-title">
            Xác nhận tạo {selectedCount} buổi học
          </h2>
          <p className="mt-2 text-body text-text-default" id={dialogDescriptionId}>
            Tạo <strong className="font-semibold text-text-strong">{selectedCount} buổi học</strong> cho lớp{" "}
            <strong className="font-semibold text-text-strong">{selectedClass?.code}</strong>. Buổi trùng với buổi đã có
            trên hệ thống được bỏ qua khi tạo; số buổi tạo thực tế hiện ngay sau khi tạo xong.
          </p>

          <dl className="mt-4 grid gap-1 rounded-md border border-border-subtle bg-surface-sunken p-3 text-secondary">
            <SummaryLine label="Ngày bắt đầu">{formatIsoDate(selectedDrafts[0]?.sessionDate)}</SummaryLine>
            <SummaryLine label="Ngày kết thúc">{formatIsoDate(selectedDrafts.at(-1)?.sessionDate)}</SummaryLine>
            <SummaryLine label="Loại buổi">{sessionKind.kind}</SummaryLine>
            <SummaryLine label="Trạng thái ban đầu">Đã lên lịch</SummaryLine>
          </dl>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              className={touchButtonClassName}
              disabled={isPending}
              onClick={() => setIsConfirmOpen(false)}
              variant="secondary"
            >
              Xem lại
            </Button>
            {/* A refresh under the open dialog can leave nothing to create (or too much): same reason as the opener. */}
            <Button
              className={touchButtonClassName}
              disabled={isPending || createBlockReason !== null}
              disabledReason={createBlockReason ?? undefined}
              onClick={handleExecuteBatchCreate}
            >
              {isPending ? "Đang tạo…" : "Xác nhận tạo"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function SummaryLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-text-muted">{label}:</dt>
      <dd className="m-0 font-semibold tabular-nums text-text-strong">{children}</dd>
    </div>
  );
}

/**
 * "Chỉnh từng buổi": the per-session edits (time, name/note, remove) behind a
 * disclosure that starts closed and renders its rows only while open.
 * Selection lives on the chips only, so this table has no checkbox column.
 */
function BatchDraftEditor({
  onDelete,
  onUpdate,
  rows,
}: {
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: DraftEdits) => void;
  rows: readonly BatchPreviewRow[];
}) {
  const baseId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details className="group min-w-0 rounded-md border border-border-subtle" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 text-body font-semibold text-text-strong hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus [&::-webkit-details-marker]:hidden">
        <span>
          Chỉnh từng buổi <span className="font-normal text-text-muted">· giờ, tên hoặc xóa khỏi danh sách</span>
        </span>
        <ChevronDown aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" size={18} />
      </summary>
      {isOpen ? (
        <div className="overflow-x-auto border-t border-border-row">
          <table className="w-full min-w-[720px] text-left text-table-body">
            <caption className="sr-only">Chỉnh giờ và tên từng buổi học của đợt tạo</caption>
            <thead className="bg-table-header text-table-header text-text-muted">
              <tr>
                <th className="w-14 px-3 py-2 font-semibold" scope="col">STT</th>
                <th className="px-3 py-2 font-semibold" scope="col">Ngày học</th>
                <th className="px-3 py-2 font-semibold" scope="col">Khung giờ</th>
                <th className="px-3 py-2 font-semibold" scope="col">Tên / Ghi chú</th>
                <th className="px-3 py-2 font-semibold" scope="col">Hình thức</th>
                <th className="px-3 py-2 font-semibold" scope="col">Trạng thái</th>
                <th className="w-14 px-3 py-2 text-right font-semibold" scope="col">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <BatchDraftEditorRow
                  dateCellId={`${baseId}-${row.draft.id}-date`}
                  key={row.draft.id}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  row={row}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}

interface BatchDraftEditorRowProps {
  dateCellId: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: DraftEdits) => void;
  row: BatchPreviewRow;
}

/**
 * One editable row, memoized on what it renders (the draft object, its flag
 * and tick): a keystroke re-renders its own row only, although the workspace
 * rebuilds every row object on each change.
 */
const BatchDraftEditorRow = memo(
  function BatchDraftEditorRow({ dateCellId, onDelete, onUpdate, row }: BatchDraftEditorRowProps) {
    const session = row.draft;
    const status = getBatchDraftRowStatus(row);
    return (
      <tr className={cn("border-t border-border-row", !row.selected && "text-text-muted")}>
        <td className="px-3 py-2 text-caption tabular-nums text-text-muted">#{session.sessionNumber}</td>
        <th className="px-3 py-2 text-left font-normal" id={dateCellId} scope="row">
          <span className="block font-semibold text-text-strong">{session.weekdayLabel}</span>
          <span className="block text-caption tabular-nums text-text-muted">{formatIsoDate(session.sessionDate)}</span>
        </th>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <input
              aria-describedby={dateCellId}
              aria-label="Sửa giờ bắt đầu"
              className={cn(rowInputClassName, "w-20 text-center tabular-nums")}
              onChange={(e) => onUpdate(session.id, { startTime: e.target.value })}
              type="text"
              value={session.startTime}
            />
            <span aria-hidden="true">–</span>
            <input
              aria-describedby={dateCellId}
              aria-label="Sửa giờ kết thúc"
              className={cn(rowInputClassName, "w-20 text-center tabular-nums")}
              onChange={(e) => onUpdate(session.id, { endTime: e.target.value })}
              type="text"
              value={session.endTime}
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <input
            aria-describedby={dateCellId}
            aria-label="Tên hoặc ghi chú buổi học"
            className={cn(rowInputClassName, "w-full")}
            onChange={(e) => onUpdate(session.id, { notes: e.target.value })}
            type="text"
            value={session.notes ?? ""}
          />
        </td>
        <td className="px-3 py-2 text-caption">
          <span className="text-text-strong">{formatLearningMode(session.learningMode)}</span>
          {session.roomName ? <span className="block truncate text-text-muted">{session.roomName}</span> : null}
        </td>
        <td className="px-3 py-2">
          <Badge tone={status.tone}>{status.label}</Badge>
        </td>
        <td className="px-3 py-2 text-right">
          <button
            aria-label={`Xóa buổi ${formatIsoDate(session.sessionDate)} khỏi danh sách`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-muted hover:bg-danger-bg hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus md:h-8 md:w-8"
            onClick={() => onDelete(session.id)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  },
  (previous, next) =>
    previous.dateCellId === next.dateCellId &&
    previous.onDelete === next.onDelete &&
    previous.onUpdate === next.onUpdate &&
    isSameBatchPreviewRow(previous.row, next.row),
);
