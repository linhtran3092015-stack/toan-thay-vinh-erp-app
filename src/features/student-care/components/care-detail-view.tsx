"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { getButtonClassName } from "@/components/ui/button";

import { careKindLabels, careStatusLabels, type CareDetail } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import {
  CARE_OWNER_REQUIRED_REASON,
  CARE_PAGE_TITLE,
  formatCareShortDateTime,
  getCareOwnerEvent,
  getCareRuleLabels,
  getCareTaskAbilities,
} from "../student-care-presentation";
import { CareActionForm, type CareActionResult } from "./care-action-form";
import {
  CareCard,
  CareCoachingCard,
  CareCompleteCard,
  CareContactCard,
  CareEvidenceCard,
  CareTimeline,
} from "./care-detail-sections";
import { CareDialogAction } from "./care-dialog-action";
import { CareNoteField, CareOwnerSelect } from "./care-form-fields";
import { CareStatusBadge } from "./care-status-badge";

export interface CareDetailViewProps {
  /** Inert stub in the /dev preview; the real page passes nothing. */
  actions?: StudentCareActionOverrides;
  canAssign: boolean;
  canHandle: boolean;
  data: CareDetail;
  /** Back link target; defaults to the queue. */
  listHref?: string;
  userId: string;
}

/** `{name} · {rules}` for an alert, `{name} · {kind}` otherwise. */
export function getCareDetailTitle(data: Pick<CareDetail, "student" | "task">): string {
  const rules = data.task.kind === "alert" ? getCareRuleLabels(data.task.evidence) : [];
  return `${data.student.full_name} · ${rules.length ? rules.join(" · ") : careKindLabels[data.task.kind]}`;
}

/**
 * /student-care/[taskId] (design 13b): header with the task's facts and one
 * primary ("Nhận việc" only when the viewer may claim), evidence and the
 * contact form on the left, completion, timeline and Coaching on the right.
 * Forms render only when the viewer may act; otherwise a sentence says why.
 * Claim, completion and the exception disappear in the re-render that carries
 * their success (the task is no longer open), so the page keeps that result
 * (per task) in a banner under the header and moves focus to it.
 */
export function CareDetailView({ actions, canAssign, canHandle, data, listHref = "/student-care", userId }: CareDetailViewProps) {
  const task = data.task;
  const action = actions?.mutateCare;
  const base = { student_id: task.student_id, task_id: task.id, version: task.version };
  const abilities = getCareTaskAbilities({ canAssign, canHandle, task, userId });
  const owner = task.owner_id ? data.assignees.find((assignee) => assignee.id === task.owner_id) : undefined;
  const ownerName = task.owner_id === null ? null : owner?.name ?? "nhân sự không còn trong danh sách phụ trách";
  const ownerEvent = getCareOwnerEvent(data.events, task);
  const [settled, setSettled] = useState<{ result: CareActionResult; taskId: string } | null>(null);
  const settledRef = useRef<HTMLDivElement>(null);
  const keepSuccess = (result: CareActionResult) => {
    if (result.ok) setSettled({ result, taskId: task.id });
  };
  const shownResult = settled?.taskId === task.id ? settled.result : null;
  useEffect(() => {
    if (shownResult) settledRef.current?.focus();
  }, [shownResult]);
  const ownerSince = ownerEvent
    ? ` (${ownerEvent.kind === "claim" ? "nhận" : "được giao"} ${formatCareShortDateTime(ownerEvent.at)})`
    : "";
  const context = [
    careKindLabels[task.kind],
    `phát hiện ${formatCareShortDateTime(task.detected_at)}`,
    ownerName ? `người xử lý ${ownerName}${ownerSince}` : "chưa giao người xử lý",
    task.contact_due_at ? `hạn liên hệ ${formatCareShortDateTime(task.contact_due_at)}` : null,
    task.next_followup_at ? `hẹn tiếp ${formatCareShortDateTime(task.next_followup_at)}` : null,
    `phiên bản ${task.version}`,
  ].filter(Boolean);

  const readOnlyReason = abilities.closed
    ? `Công việc đã kết thúc (${careStatusLabels[task.status]}). Không ghi thêm liên hệ được; lịch sử vẫn giữ trong dòng thời gian.`
    : !canHandle
      ? "Anh/chị chỉ có quyền xem chăm sóc học sinh, nên không ghi nhận liên hệ được."
      : task.owner_id === null
        ? `Công việc chưa có người nhận. ${CARE_OWNER_REQUIRED_REASON}`
        : `Công việc này do ${ownerName} phụ trách. Chỉ người phụ trách hoặc người điều phối được ghi nhận liên hệ.`;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label="Điều hướng công việc chăm sóc" className="text-secondary">
        <Link
          className="inline-flex items-center gap-1 font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          href={listHref}
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          {CARE_PAGE_TITLE}
        </Link>
      </nav>

      <PageHeader
        actions={
          <>
            {abilities.canReassign ? (
              <CareDialogAction
                action={action}
                base={{ ...base, op: "assign" }}
                description="Chuyển công việc này cho một trợ lý khác. Lý do được lưu trong dòng thời gian."
                submitLabel="Chuyển người xử lý"
                title="Giao cho người khác"
                triggerLabel="Giao cho người khác"
              >
                <CareOwnerSelect assignees={data.assignees} label="Người xử lý mới" />
                <CareNoteField label="Lý do" />
              </CareDialogAction>
            ) : null}
            <Link className={getButtonClassName({ variant: "secondary" })} href={`/students/${data.student.id}`}>
              Hồ sơ học sinh
            </Link>
            {abilities.canClaim ? (
              <CareActionForm action={action} base={{ ...base, op: "claim" }} label="Nhận việc" onResult={keepSuccess} submitVariant="primary" />
            ) : null}
          </>
        }
        context={<CareStatusBadge status={task.status} />}
        title={getCareDetailTitle(data)}
      >
        <p className="mt-1 text-secondary tabular-nums text-text-muted">{context.join(" · ")}</p>
      </PageHeader>

      {shownResult ? (
        <div className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" ref={settledRef} tabIndex={-1}>
          <ResultBanner title={shownResult.message} tone="success" />
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 gap-5">
          {task.kind === "alert" ? <CareEvidenceCard task={task} /> : null}
          {abilities.canEdit ? (
            <CareContactCard action={action} base={base} isPagePrimary={!abilities.canClaim} kind={task.kind} />
          ) : (
            <CareCard title="Ghi nhận liên hệ">
              <p className="px-4 py-3 text-secondary text-text-default">{readOnlyReason}</p>
            </CareCard>
          )}
        </div>
        <div className="grid min-w-0 gap-5">
          {abilities.closed ? (
            <CareCard title="Kết quả">
              <div className="grid gap-1 px-4 py-3 text-secondary">
                <p className="tabular-nums text-text-muted">
                  {careStatusLabels[task.status]} · {formatCareShortDateTime(task.completed_at)}
                </p>
                <p className="whitespace-pre-wrap break-words text-text-default">{task.outcome ?? "Không có ghi chú kết quả."}</p>
              </div>
            </CareCard>
          ) : abilities.canEdit || abilities.canReassign ? (
            <CareCompleteCard
              action={action}
              base={base}
              canCancel={abilities.canCancel}
              canEdit={abilities.canEdit}
              detail={data}
              needsOwner={abilities.needsOwner}
              onResult={keepSuccess}
            />
          ) : null}
          <CareTimeline events={data.events} taskId={task.id} />
          <CareCoachingCard detail={data} />
        </div>
      </div>
    </div>
  );
}
