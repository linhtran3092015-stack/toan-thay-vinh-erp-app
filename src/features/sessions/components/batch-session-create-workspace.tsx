"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  RefreshCw,
  Layers,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import {
  type BatchClassOption,
  type BatchScheduleOption,
  type ExistingSessionSnapshot,
  calculateBatchOccurrences,
  formatUtcDate,
  VIETNAMESE_WEEKDAY_NAMES,
  VIETNAMESE_SHORT_WEEKDAYS,
} from "../batch-calculation";
import type { BatchSessionDraftItem } from "../forms/session-batch-schema";
import {
  type BatchSessionActionResult,
  createBatchSessionsAction,
} from "../actions/session-batch-actions";
import type { SessionLearningMode } from "../read-models";

interface BatchSessionCreateWorkspaceProps {
  classes: BatchClassOption[];
  schedules: BatchScheduleOption[];
  existingSessions: ExistingSessionSnapshot[];
  existingSessionCount: number;
  selectedClassId: string;
  directoryQuery?: string;
}

const inputClass =
  "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export function BatchSessionCreateWorkspace({
  classes,
  schedules,
  existingSessions,
  existingSessionCount,
  selectedClassId,
  directoryQuery = "",
}: BatchSessionCreateWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. Current selected class
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId],
  );

  // 2. Generation Strategy
  const [strategy, setStrategy] = useState<"template" | "custom">(
    schedules.length > 0 ? "template" : "custom",
  );

  // Selected schedule templates (default all active)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(() =>
    schedules.map((s) => s.id),
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
  const [rangeMode, setRangeMode] = useState<"count" | "date_range">("count");
  const [sessionCount, setSessionCount] = useState(10);

  const todayStr = useMemo(() => formatUtcDate(new Date()), []);
  const [startDate, setStartDate] = useState(todayStr);

  const defaultEndDateStr = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 60);
    return formatUtcDate(d);
  }, []);
  const [endDate, setEndDate] = useState(defaultEndDateStr);

  // 4. Naming pattern & Start number
  const [namingPattern, setNamingPattern] = useState("Buổi {n}");
  const [startNumber, setStartNumber] = useState(existingSessionCount + 1);

  // Handle class switch
  const handleClassChange = (newId: string) => {
    const query = directoryQuery ? `?classId=${newId}&${directoryQuery}` : `?classId=${newId}`;
    router.replace(`/sessions/batch${query}`);
  };

  // 5. Calculate initial draft sessions
  const generatedDrafts = useMemo(() => {
    if (!selectedClass) return [];

    let calculationSlots: Array<{
      scheduleTemplateId?: string | null;
      weekday: number;
      startTime: string;
      endTime: string;
      learningMode: SessionLearningMode;
      roomName?: string | null;
      meetingUrl?: string | null;
      componentCode?: string | null;
    }> = [];

    if (strategy === "template") {
      const activeTemplates = schedules.filter((s) => selectedTemplateIds.includes(s.id));
      calculationSlots = activeTemplates.map((t) => ({
        scheduleTemplateId: t.id,
        weekday: t.weekday,
        startTime: t.startTime,
        endTime: t.endTime,
        learningMode: t.learningMode,
        roomName: t.roomName,
        meetingUrl: t.meetingUrl,
        componentCode: t.componentCode,
      }));
    } else {
      calculationSlots = customWeekdays.map((w) => ({
        weekday: w,
        startTime: customStartTime,
        endTime: customEndTime,
        learningMode: customLearningMode,
        roomName: customRoomName || null,
        meetingUrl: customMeetingUrl || null,
        componentCode: customComponentCode || null,
      }));
    }

    return calculateBatchOccurrences({
      startDate,
      endDate: rangeMode === "date_range" ? endDate : undefined,
      rangeMode,
      count: sessionCount,
      slots: calculationSlots,
      namingPattern,
      startNumber,
      existingSessions,
      today: todayStr,
    });
  }, [
    selectedClass,
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
    existingSessions,
    todayStr,
  ]);

  // Working state for drafts (allows manual checkboxes, inline edits, removal)
  const [draftSessions, setDraftSessions] = useState<BatchSessionDraftItem[]>(generatedDrafts);

  // Sync when generatedDrafts changes fundamentally
  const [lastGeneratedKey, setLastGeneratedKey] = useState("");
  const currentKey = `${selectedClassId}_${strategy}_${selectedTemplateIds.join(",")}_${customWeekdays.join(",")}_${customStartTime}_${customEndTime}_${rangeMode}_${startDate}_${endDate}_${sessionCount}_${namingPattern}_${startNumber}`;

  if (lastGeneratedKey !== currentKey) {
    setLastGeneratedKey(currentKey);
    setDraftSessions(generatedDrafts);
  }

  // Checkbox toggle handler
  const handleToggleSelect = (id: string) => {
    setDraftSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    );
  };

  const handleToggleAll = () => {
    const anyUnselected = draftSessions.some((s) => !s.selected);
    setDraftSessions((prev) => prev.map((s) => ({ ...s, selected: anyUnselected })));
  };

  const handleDeleteDraft = (id: string) => {
    setDraftSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Inline update for specific draft
  const handleUpdateDraft = (
    id: string,
    updates: Partial<Pick<BatchSessionDraftItem, "startTime" | "endTime" | "notes" | "roomName">>,
  ) => {
    setDraftSessions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  // Selection statistics
  const selectedCount = draftSessions.filter((s) => s.selected).length;
  const duplicateCount = draftSessions.filter((s) => s.statusConflict === "duplicate").length;
  const pastCount = draftSessions.filter((s) => s.statusConflict === "past").length;

  // Confirmation dialog and submission
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<BatchSessionActionResult | null>(null);

  const handleExecuteBatchCreate = async () => {
    if (!selectedClass || selectedCount === 0) return;

    const chosenSessions = draftSessions.filter((s) => s.selected);

    startTransition(async () => {
      try {
        const result = await createBatchSessionsAction({
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

  return (
    <div className="grid min-w-0 gap-6">
      {/* Navigation breadcrumb */}
      <nav aria-label="Điều hướng" className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
        <Link
          className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
          href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
        >
          Buổi học
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink">Tạo buổi học hàng loạt</span>
      </nav>

      <PageHeader
        context={
          <Badge tone="info">
            <Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
            ClassIn Batch Creator
          </Badge>
        }
        title="Tạo buổi học hàng loạt"
      >
        <p className="mt-1 text-secondary text-text-muted">
          Tạo nhiều buổi học định kỳ cho lớp theo lịch cố định hoặc tùy chỉnh, xem trước ngày học, loại trừ ngày nghỉ và kiểm tra trùng lịch.
        </p>
      </PageHeader>

      {/* Result feedback banner */}
      {submitResult && (
        <div
          aria-live="polite"
          className={`flex items-start justify-between rounded-lg border p-4 ${
            submitResult.status === "success"
              ? "border-success-border bg-success-bg text-success"
              : "border-danger-border bg-danger-bg text-danger"
          }`}
          role="alert"
        >
          <div className="flex items-center gap-3">
            {submitResult.status === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">{submitResult.message}</p>
              {submitResult.status === "success" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-8 items-center justify-center rounded-md bg-action-primary px-3 text-caption font-semibold text-text-on-primary hover:bg-action-primary-hover"
                    href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
                  >
                    Xem danh sách buổi học
                  </Link>
                  {selectedClass && (
                    <Link
                      className="inline-flex h-8 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-3 text-caption font-semibold text-text-strong hover:bg-interactive-hover"
                      href={`/classes/${selectedClass.id}`}
                    >
                      Mở lớp {selectedClass.code}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            className="h-8 text-caption"
            onClick={() => setSubmitResult(null)}
            variant="ghost"
          >
            Đóng
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* LEFT COLUMN: Rule Configuration */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-section-title">
                <Layers className="h-5 w-5 text-action-link" />
                1. Lớp học & Quy tắc lặp
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-body">
              {/* Class Selector */}
              <div>
                <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="class-selector">
                  Chọn lớp học áp dụng <span className="text-danger">*</span>
                </label>
                <select
                  className={inputClass}
                  id="class-selector"
                  onChange={(e) => handleClassChange(e.target.value)}
                  value={selectedClass?.id ?? ""}
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.code} — {cls.name} (Khối {cls.grade})
                    </option>
                  ))}
                </select>
                {selectedClass && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-muted">
                    <span>Trình độ: {selectedClass.level}</span>
                    <span>·</span>
                    <span>Hình thức: {selectedClass.defaultLearningMode}</span>
                    <span>·</span>
                    <span className="font-semibold text-ink">
                      Đã có {existingSessionCount} buổi
                    </span>
                  </div>
                )}
              </div>

              {/* Strategy toggle */}
              <div>
                <label className="mb-1.5 block text-label font-medium text-text-muted">
                  Phương thức sinh lịch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`flex h-11 items-center justify-center rounded-md border text-control font-semibold transition ${
                      strategy === "template"
                        ? "border-action-primary bg-action-primary-soft text-action-primary"
                        : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover"
                    }`}
                    onClick={() => setStrategy("template")}
                    type="button"
                  >
                    Theo lịch cố định
                  </button>
                  <button
                    className={`flex h-11 items-center justify-center rounded-md border text-control font-semibold transition ${
                      strategy === "custom"
                        ? "border-action-primary bg-action-primary-soft text-action-primary"
                        : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover"
                    }`}
                    onClick={() => setStrategy("custom")}
                    type="button"
                  >
                    Lịch lặp tùy chỉnh
                  </button>
                </div>
              </div>

              {/* Template strategy content */}
              {strategy === "template" && (
                <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3">
                  <p className="mb-2 text-caption font-semibold text-text-muted">
                    Lịch học cố định đang có của lớp:
                  </p>
                  {schedules.length === 0 ? (
                    <div className="py-2 text-center text-caption text-warning">
                      Lớp chưa có lịch học cố định nào đang hiệu lực. Hãy chọn &quot;Lịch lặp tùy chỉnh&quot;.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {schedules.map((sch) => {
                        const isChecked = selectedTemplateIds.includes(sch.id);
                        return (
                          <label
                            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border-subtle bg-surface-base p-2.5 hover:bg-surface-raised"
                            key={sch.id}
                          >
                            <input
                              checked={isChecked}
                              className="mt-0.5 h-4 w-4 rounded accent-action-primary"
                              onChange={() => {
                                setSelectedTemplateIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== sch.id) : [...prev, sch.id],
                                );
                              }}
                              type="checkbox"
                            />
                            <div className="min-w-0 text-caption">
                              <span className="font-semibold text-text-strong">
                                {VIETNAMESE_WEEKDAY_NAMES[sch.weekday]}: {sch.startTime.slice(0, 5)} – {sch.endTime.slice(0, 5)}
                              </span>
                              <p className="text-text-muted">
                                {sch.learningMode}
                                {sch.roomName ? ` · ${sch.roomName}` : ""}
                                {sch.componentCode ? ` · ${sch.componentCode}` : ""}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Custom recurrence strategy content */}
              {strategy === "custom" && (
                <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-3">
                  <div>
                    <label className="mb-1 block text-caption font-semibold text-text-muted">
                      Chọn các ngày học trong tuần
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                        const isSelected = customWeekdays.includes(wd);
                        return (
                          <button
                            className={`flex h-9 w-11 items-center justify-center rounded-md border text-caption font-semibold transition ${
                              isSelected
                                ? "border-action-primary bg-action-primary text-text-on-primary"
                                : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover"
                            }`}
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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-start-time">
                        Giờ bắt đầu
                      </label>
                      <input
                        className={inputClass}
                        id="custom-start-time"
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        type="time"
                        value={customStartTime}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-end-time">
                        Giờ kết thúc
                      </label>
                      <input
                        className={inputClass}
                        id="custom-end-time"
                        onChange={(e) => setCustomEndTime(e.target.value)}
                        type="time"
                        value={customEndTime}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-mode">
                        Hình thức
                      </label>
                      <select
                        className={inputClass}
                        id="custom-mode"
                        onChange={(e) => setCustomLearningMode(e.target.value as SessionLearningMode)}
                        value={customLearningMode}
                      >
                        <option value="offline">Offline</option>
                        <option value="online">Online</option>
                        <option value="hybrid">Kết hợp</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-room">
                        Phòng học
                      </label>
                      <input
                        className={inputClass}
                        id="custom-room"
                        onChange={(e) => setCustomRoomName(e.target.value)}
                        placeholder="VD: Phòng 101"
                        type="text"
                        value={customRoomName}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-url">
                        Link phòng (ClassIn / Meet)
                      </label>
                      <input
                        className={inputClass}
                        id="custom-url"
                        onChange={(e) => setCustomMeetingUrl(e.target.value)}
                        placeholder="https://..."
                        type="url"
                        value={customMeetingUrl}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-caption text-text-muted" htmlFor="custom-component">
                        Mã thành phần
                      </label>
                      <input
                        className={inputClass}
                        id="custom-component"
                        onChange={(e) => setCustomComponentCode(e.target.value.toUpperCase())}
                        placeholder="VD: DS, HH..."
                        type="text"
                        value={customComponentCode}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Range & Naming Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-section-title">
                <Calendar className="h-5 w-5 text-action-link" />
                2. Phạm vi & Tên buổi học
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-body">
              {/* Range Mode radio */}
              <div>
                <label className="mb-1.5 block text-label font-medium text-text-muted">
                  Cách xác định số lượng
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-md border p-2 text-caption font-semibold transition ${
                      rangeMode === "count"
                        ? "border-action-primary bg-action-primary-soft text-action-primary"
                        : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover"
                    }`}
                  >
                    <input
                      checked={rangeMode === "count"}
                      className="sr-only"
                      name="rangeMode"
                      onChange={() => setRangeMode("count")}
                      type="radio"
                      value="count"
                    />
                    Theo số buổi (ClassIn)
                  </label>
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-md border p-2 text-caption font-semibold transition ${
                      rangeMode === "date_range"
                        ? "border-action-primary bg-action-primary-soft text-action-primary"
                        : "border-border-subtle bg-surface-base text-text-muted hover:bg-interactive-hover"
                    }`}
                  >
                    <input
                      checked={rangeMode === "date_range"}
                      className="sr-only"
                      name="rangeMode"
                      onChange={() => setRangeMode("date_range")}
                      type="radio"
                      value="date_range"
                    />
                    Theo khoảng ngày
                  </label>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="start-date">
                  Bắt đầu từ ngày <span className="text-danger">*</span>
                </label>
                <input
                  className={inputClass}
                  id="start-date"
                  onChange={(e) => setStartDate(e.target.value)}
                  type="date"
                  value={startDate}
                />
              </div>

              {rangeMode === "count" ? (
                <div>
                  <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="session-count">
                    Số buổi học cần tạo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClass}
                      id="session-count"
                      max={60}
                      min={1}
                      onChange={(e) => setSessionCount(Math.max(1, Number(e.target.value) || 1))}
                      type="number"
                      value={sessionCount}
                    />
                    <span className="shrink-0 text-caption text-text-muted">buổi học</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 24].map((num) => (
                      <button
                        className="rounded border border-border-subtle bg-surface-base px-2 py-0.5 text-caption font-semibold text-text-muted hover:bg-interactive-hover"
                        key={num}
                        onClick={() => setSessionCount(num)}
                        type="button"
                      >
                        +{num} buổi
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="end-date">
                    Đến hết ngày <span className="text-danger">*</span>
                  </label>
                  <input
                    className={inputClass}
                    id="end-date"
                    onChange={(e) => setEndDate(e.target.value)}
                    type="date"
                    value={endDate}
                  />
                </div>
              )}

              {/* Naming Pattern */}
              <div className="grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
                <div>
                  <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="naming-pattern">
                    Mẫu tên ({`{n}`})
                  </label>
                  <input
                    className={inputClass}
                    id="naming-pattern"
                    onChange={(e) => setNamingPattern(e.target.value)}
                    placeholder="Buổi {n}"
                    type="text"
                    value={namingPattern}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-label font-medium text-text-muted" htmlFor="start-number">
                    Số bắt đầu
                  </label>
                  <input
                    className={inputClass}
                    id="start-number"
                    min={1}
                    onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                    type="number"
                    value={startNumber}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Interactive Smart Preview Table */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <CardTitle className="text-section-title">
                  3. Bảng xem trước danh sách buổi học
                </CardTitle>
                <p className="mt-0.5 text-caption text-text-muted">
                  Kiểm tra ngày học, bỏ tick những ngày nghỉ lễ hoặc điều chỉnh giờ từng buổi trước khi tạo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-8 text-caption"
                  onClick={handleToggleAll}
                  type="button"
                  variant="outline"
                >
                  {draftSessions.some((s) => !s.selected) ? "Chọn tất cả" : "Bỏ chọn tất cả"}
                </Button>
              </div>
            </CardHeader>

            {/* Selection summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-sunken px-4 py-2.5 text-secondary">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-text-strong">
                  Đã chọn:{" "}
                  <span className="text-action-link font-bold">
                    {selectedCount}
                  </span>{" "}
                  / {draftSessions.length} buổi
                </span>
                {duplicateCount > 0 && (
                  <Badge tone="warning">
                    {duplicateCount} buổi bị trùng lịch (đã tự bỏ chọn)
                  </Badge>
                )}
                {pastCount > 0 && (
                  <Badge tone="neutral">
                    {pastCount} buổi ngày trong quá khứ
                  </Badge>
                )}
              </div>
              <p className="text-caption text-text-muted">
                Dự kiến từ:{" "}
                <strong className="text-text-strong">
                  {draftSessions[0]?.sessionDate ?? "—"}
                </strong>{" "}
                đến{" "}
                <strong className="text-text-strong">
                  {draftSessions[draftSessions.length - 1]?.sessionDate ?? "—"}
                </strong>
              </p>
            </div>

            <CardContent className="p-0">
              {draftSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                  <Clock className="mb-2 h-10 w-10 text-text-muted opacity-50" />
                  <p className="font-semibold">Chưa có buổi học nào được tính toán.</p>
                  <p className="mt-1 text-caption">
                    Hãy kiểm tra lại việc chọn lịch cố định hoặc thứ trong tuần ở cột cấu hình bên trái.
                  </p>
                </div>
              ) : (
                <div className="max-h-[580px] overflow-auto">
                  <table className="w-full min-w-[680px] table-fixed text-left text-table-body">
                    <thead className="sticky top-0 z-10 border-b border-border-subtle bg-surface-sunken text-caption font-semibold text-text-muted">
                      <tr>
                        <th className="w-12 px-3 py-2.5 text-center">
                          <input
                            aria-label="Chọn tất cả các buổi"
                            checked={draftSessions.length > 0 && draftSessions.every((s) => s.selected)}
                            className="h-4 w-4 rounded accent-action-primary"
                            onChange={handleToggleAll}
                            type="checkbox"
                          />
                        </th>
                        <th className="w-16 px-3 py-2.5">STT</th>
                        <th className="w-48 px-3 py-2.5">Ngày học</th>
                        <th className="w-36 px-3 py-2.5">Khung giờ</th>
                        <th className="w-44 px-3 py-2.5">Tên / Ghi chú</th>
                        <th className="w-32 px-3 py-2.5">Hình thức</th>
                        <th className="w-36 px-3 py-2.5">Trạng thái</th>
                        <th className="w-16 px-3 py-2.5 text-right">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {draftSessions.map((session) => {
                        const isDuplicate = session.statusConflict === "duplicate";
                        const isPast = session.statusConflict === "past";

                        return (
                          <tr
                            className={`transition hover:bg-surface-raised ${
                              !session.selected ? "opacity-60 bg-surface-sunken" : ""
                            }`}
                            key={session.id}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <input
                                aria-label={`Chọn buổi học ngày ${session.sessionDate}`}
                                checked={session.selected}
                                className="h-4 w-4 rounded accent-action-primary"
                                onChange={() => handleToggleSelect(session.id)}
                                type="checkbox"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono text-caption text-text-muted">
                              #{session.sessionNumber}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-text-strong">
                                {session.weekdayLabel}
                              </span>
                              <p className="font-mono text-caption text-text-muted">
                                {session.sessionDate}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1 font-mono text-caption text-text-strong">
                                <input
                                  aria-label="Sửa giờ bắt đầu"
                                  className="h-7 w-16 rounded border border-border-subtle bg-field-bg px-1 text-center font-mono text-caption"
                                  onChange={(e) =>
                                    handleUpdateDraft(session.id, { startTime: e.target.value })
                                  }
                                  type="text"
                                  value={session.startTime}
                                />
                                <span>-</span>
                                <input
                                  aria-label="Sửa giờ kết thúc"
                                  className="h-7 w-16 rounded border border-border-subtle bg-field-bg px-1 text-center font-mono text-caption"
                                  onChange={(e) =>
                                    handleUpdateDraft(session.id, { endTime: e.target.value })
                                  }
                                  type="text"
                                  value={session.endTime}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                aria-label="Tên hoặc ghi chú buổi học"
                                className="h-7 w-full rounded border border-border-subtle bg-field-bg px-2 text-caption text-text-strong"
                                onChange={(e) =>
                                  handleUpdateDraft(session.id, { notes: e.target.value })
                                }
                                type="text"
                                value={session.notes ?? ""}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-caption">
                              <span className="text-text-strong">{session.learningMode}</span>
                              {session.roomName && (
                                <p className="text-caption text-text-muted truncate">
                                  {session.roomName}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {isDuplicate ? (
                                <Badge tone="warning">Trùng lịch</Badge>
                              ) : isPast ? (
                                <Badge tone="neutral">Đã qua</Badge>
                              ) : (
                                <Badge tone="success">Hợp lệ</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                aria-label={`Xóa buổi ${session.sessionDate} khỏi danh sách`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                                onClick={() => handleDeleteDraft(session.id)}
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            {/* Bottom action button area */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-base p-4">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-4 text-control font-semibold text-text-strong hover:bg-interactive-hover"
                href={directoryQuery ? `/sessions?${directoryQuery}` : "/sessions"}
              >
                Hủy bỏ
              </Link>
              <Button
                className="min-h-10 px-6 font-semibold"
                disabled={selectedCount === 0 || isPending}
                onClick={() => setIsConfirmOpen(true)}
                type="button"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>Tạo hàng loạt ({selectedCount} buổi học)</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        ariaLabelledBy="confirm-batch-dialog-title"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
      >
        <div className="p-6">
          <h2 className="text-section-title font-semibold text-text-strong" id="confirm-batch-dialog-title">
            Xác nhận tạo {selectedCount} buổi học
          </h2>
          <p className="mt-2 text-body text-text-muted">
            Bạn có chắc chắn muốn tạo đồng loạt{" "}
            <strong className="text-text-strong">{selectedCount} buổi học</strong> cho lớp{" "}
            <strong className="text-text-strong">{selectedClass?.code}</strong> không?
          </p>

          <div className="mt-4 rounded-md border border-border-subtle bg-surface-sunken p-3 text-caption text-text-muted">
            <p>
              • Ngày bắt đầu: <span className="font-semibold text-text-strong">{draftSessions.filter((s) => s.selected)[0]?.sessionDate}</span>
            </p>
            <p>
              • Ngày kết thúc: <span className="font-semibold text-text-strong">{draftSessions.filter((s) => s.selected).slice(-1)[0]?.sessionDate}</span>
            </p>
            <p>
              • Trạng thái ban đầu: <span className="font-semibold text-text-strong">Đã lên lịch (scheduled)</span>
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              disabled={isPending}
              onClick={() => setIsConfirmOpen(false)}
              variant="outline"
            >
              Xem lại
            </Button>
            <Button
              disabled={isPending}
              onClick={handleExecuteBatchCreate}
            >
              {isPending ? "Đang tạo..." : "Xác nhận tạo"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
