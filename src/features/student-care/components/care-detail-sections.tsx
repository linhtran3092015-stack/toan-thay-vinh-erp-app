import Link from "next/link";
import type { ReactNode } from "react";

import { TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { Badge } from "@/components/ui/badge";
import { formatIsoDate, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import type { CareDetail } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import {
  CARE_OWNER_REQUIRED_REASON,
  formatCareScore,
  formatCareShortDateTime,
  getCareAttendanceBadge,
  getCareEvidenceGroups,
  getCareRuleLabels,
  type CareEvidenceRow,
  type CareTask,
} from "../student-care-presentation";
import { CareActionForm, type CareActionResult } from "./care-action-form";
import { CareDialogAction } from "./care-dialog-action";
import {
  CareDateTimeField,
  CareNoteField,
  CareSegmentedRadio,
  CareSelectField,
  CareTextField,
} from "./care-form-fields";

type Base = { student_id: string; task_id: string; version: number };

export function CareCard({ children, title, titleAside }: { children: ReactNode; title: string; titleAside?: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-row px-4 py-3">
        <h2 className="text-body font-semibold text-text-strong">{title}</h2>
        {titleAside}
      </div>
      {children}
    </section>
  );
}

/** Evidence of an alert (design 13b): one table per rule, newest session first, with the "current / changed" badge. */
export function CareEvidenceCard({ task }: { task: CareTask }) {
  const groups = getCareEvidenceGroups(task.evidence);
  return (
    <CareCard
      title="Bằng chứng"
      titleAside={
        task.evidence_current ? <Badge tone="success">hiện hành</Badge> : <Badge tone="warning">bằng chứng đã thay đổi</Badge>
      }
    >
      {!task.evidence_current ? (
        <p className="border-b border-warning-border bg-warning-bg px-4 py-2.5 text-secondary text-warning-ink" role="alert">
          Dữ liệu hiện tại không còn đủ điều kiện. Lịch sử được giữ lại; cần rà soát trước khi kết thúc việc.
        </p>
      ) : null}
      {groups === null ? (
        <p className="px-4 py-3 text-secondary text-danger">Không đọc được bằng chứng. Vui lòng kiểm tra dữ liệu.</p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-3 text-secondary text-text-muted">Không có bằng chứng được lưu cho cảnh báo này.</p>
      ) : (
        groups.map((group) => (
          <div className="min-w-0" key={group.rule}>
            {groups.length > 1 ? <h3 className="px-4 pb-1 pt-3 text-secondary font-semibold text-text-strong">{group.label}</h3> : null}
            <EvidenceTable caption={group.label} rows={group.rows} />
          </div>
        ))
      )}
    </CareCard>
  );
}

function EvidenceTable({ caption, rows }: { caption: string; rows: CareEvidenceRow[] }) {
  const ordered = [...rows].sort((a, b) => `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-table-body text-text-default">
        <caption className="sr-only">Bằng chứng · {caption}</caption>
        <thead className="bg-table-header text-table-header text-text-muted">
          <tr>
            <TableHeaderCell className="w-[110px]">Ngày</TableHeaderCell>
            <TableHeaderCell>Buổi</TableHeaderCell>
            <TableHeaderCell className="w-[150px]">Điểm danh</TableHeaderCell>
            <TableHeaderCell className="w-[80px]" numeric>
              Điểm
            </TableHeaderCell>
          </tr>
        </thead>
        <tbody className="[&>tr>td]:border-t [&>tr>td]:border-border-row">
          {ordered.map((row) => {
            const badge = getCareAttendanceBadge(row.attendance_status);
            return (
              <TableRow className="h-11" key={row.session_id}>
                <TableCell className="tabular-nums text-text-muted">{formatIsoDate(row.session_date)}</TableCell>
                <TableCell>
                  <Link
                    className="font-medium text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    href={`/sessions/${row.session_id}`}
                  >
                    {formatTime(row.start_time)} · {row.class_name}
                  </Link>
                </TableCell>
                <TableCell>{badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <span className="text-text-subtle">—</span>}</TableCell>
                <TableCell className={row.test_score === null ? "text-text-subtle" : undefined} numeric>
                  {formatCareScore(row.test_score)}
                </TableCell>
              </TableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const channelOptions = [
  { label: "Điện thoại", value: "phone" },
  { label: "Zalo", value: "zalo" },
  { label: "Gặp trực tiếp", value: "in_person" },
  { label: "Khác", value: "other" },
] as const;
const recipientOptions = [
  { label: "Phụ huynh", value: "guardian" },
  { label: "Học sinh", value: "student" },
  { label: "Cả hai", value: "both" },
] as const;
const successOptions = [
  { label: "Đã trao đổi thực chất", value: "true" },
  { label: "Chưa liên lạc được", value: "false" },
] as const;

const channelLabels: Record<string, string> = Object.fromEntries(channelOptions.map((option) => [option.value, option.label]));
const recipientLabels: Record<string, string> = Object.fromEntries(recipientOptions.map((option) => [option.value, option.label]));

/** "Ghi nhận liên hệ" (op contact): segmented choices, the four checklist fields, note and the next contact time. */
export function CareContactCard({ action, base, isPagePrimary, kind }: { action?: StudentCareActionOverrides["mutateCare"]; base: Base; isPagePrimary: boolean; kind: CareTask["kind"] }) {
  return (
    <CareCard title="Ghi nhận liên hệ">
      <CareActionForm
        action={action}
        base={{ ...base, op: "contact" }}
        className="px-4 py-4 sm:px-5"
        label="Lưu lần liên hệ"
        submitVariant={isPagePrimary ? "primary" : "secondary"}
      >
        <div className="grid gap-3">
          <CareSegmentedRadio defaultValue="phone" label="Kênh" name="channel" options={channelOptions} />
          <CareSegmentedRadio defaultValue="guardian" label="Người nhận" name="recipient" options={recipientOptions} />
          <CareSegmentedRadio defaultValue="true" label="Kết quả liên hệ" name="success" options={successOptions} />
        </div>
        <p className="text-caption text-text-muted">
          Khi đã trao đổi thực chất, cần ghi đủ Điểm mạnh, Khó khăn, Kế hoạch và Kết quả
          {kind === "followup" ? "." : ", kèm lịch liên hệ tiếp."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CareTextField label="Điểm mạnh" name="strengths" />
          <CareTextField label="Khó khăn" name="difficulties" />
          <CareTextField label="Kế hoạch" name="plan" />
          <CareTextField label="Kết quả" name="outcome" />
        </div>
        <CareNoteField label="Ghi chú" placeholder="Nội dung trao đổi, lý do vắng, cam kết của gia đình…" />
        <CareDateTimeField
          hint={kind === "followup" ? "Để trống nếu đã trao đổi và không cần theo dõi thêm." : undefined}
          label="Hẹn liên hệ tiếp (giờ VN)"
          required={kind !== "followup"}
        />
      </CareActionForm>
    </CareCard>
  );
}

export const CARE_COMPLETE_DISABLED_REASON = "Bật khi có ít nhất một lần liên hệ “đã trao đổi thực chất”.";

/**
 * "Hoàn thành công việc" (op complete) plus the follow-up commands kept in
 * dialogs: link or create a Coaching record, reschedule, and the exception
 * (cancel, student_care.assign only). `contacts` from get_student_care_detail
 * holds only successful contacts that can close this task (same task, or for
 * a monthly task this period and not yet used), so an empty list = nothing
 * can complete it yet. On an unowned task none of these commands is offered
 * (the RPC answers STUDENT_CARE_CLAIM_FIRST); `needsOwner` says why instead.
 */
export function CareCompleteCard({
  action,
  base,
  canCancel,
  canEdit,
  detail,
  needsOwner,
  onResult,
}: {
  action?: StudentCareActionOverrides["mutateCare"];
  base: Base;
  canCancel: boolean;
  canEdit: boolean;
  detail: CareDetail;
  needsOwner: boolean;
  /** Completion and the exception close the task, so the re-render with their success removes this card: the page keeps the result. */
  onResult?: (result: CareActionResult) => void;
}) {
  const task = detail.task;
  const hasContact = detail.contacts.length > 0;
  return (
    <CareCard title="Hoàn thành công việc">
      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <p className="text-secondary text-text-muted">Chọn lần trao đổi đủ nội dung. Lịch hẹn tiếp theo được tách thành một việc theo dõi riêng.</p>
        {task.kind === "monthly" ? (
          <p className="text-secondary text-text-default">
            Hạn hoàn thành kỳ: <span className="tabular-nums">{formatCareShortDateTime(task.due_at)}</span>. Gửi form hoặc gọi không bắt máy chưa tính là hoàn thành.
          </p>
        ) : null}
        {needsOwner ? (
          <p className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2 text-secondary font-medium text-text-default">{CARE_OWNER_REQUIRED_REASON}</p>
        ) : null}
        {canEdit ? (
          <CareActionForm
            action={action}
            base={{ ...base, op: "complete" }}
            disabledReason={hasContact ? undefined : CARE_COMPLETE_DISABLED_REASON}
            label="Ghi nhận hoàn thành"
            onResult={onResult}
            submitDisabled={!hasContact}
          >
            <CareSelectField label="Lần trao đổi" name="contact_event_id" required>
              <option disabled value="">
                {hasContact ? "Chọn lần trao đổi" : "Chưa có lần trao đổi đủ điều kiện"}
              </option>
              {detail.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {formatCareShortDateTime(contact.contact_at)} · {contact.note.slice(0, 90)}
                </option>
              ))}
            </CareSelectField>
            <CareNoteField label="Kết luận" />
          </CareActionForm>
        ) : null}
        {canEdit || canCancel ? (
          <div className="flex flex-wrap items-start gap-2 border-t border-border-row pt-3">
            {canEdit ? (
              <>
                <CareDialogAction
                  action={action}
                  base={{ ...base, op: "coaching" }}
                  description="Gắn một phiếu Coaching có sẵn của học sinh hoặc tạo phiếu mới, kèm lịch theo dõi."
                  submitLabel="Lưu liên kết Coaching"
                  title="Tạo / gắn phiếu Coaching"
                  triggerLabel="Tạo / gắn phiếu Coaching…"
                >
                  <CareSelectField label="Phiếu Coaching" name="coaching_id">
                    <option value="">Tạo phiếu Coaching mới</option>
                    {detail.available_coaching.map((coaching) => (
                      <option key={coaching.id} value={coaching.id}>
                        {coaching.campaign_name}
                      </option>
                    ))}
                  </CareSelectField>
                  <CareNoteField label="Lý do Coaching" />
                  <CareDateTimeField label="Ngày giờ theo dõi (giờ Việt Nam)" required />
                </CareDialogAction>
                <CareDialogAction
                  action={action}
                  base={{ ...base, op: "schedule" }}
                  description="Đổi lịch hẹn liên hệ tiếp; công việc chuyển sang Đang theo dõi."
                  submitLabel="Lưu lịch hẹn"
                  title="Đổi lịch hẹn"
                  triggerLabel="Đổi lịch hẹn…"
                >
                  <CareNoteField />
                  <CareDateTimeField label="Hẹn theo dõi (giờ Việt Nam)" required />
                </CareDialogAction>
              </>
            ) : null}
            {canCancel ? (
              <CareDialogAction
                action={action}
                base={{ ...base, op: "cancel" }}
                consequence="Ngoại lệ không tính là Coaching hoàn thành. Công việc kết thúc và không mở lại được."
                description="Ghi nhận một ngoại lệ đã được duyệt thay cho việc hoàn thành công việc này."
                onResult={onResult}
                submitLabel="Ghi nhận ngoại lệ"
                submitVariant="danger-solid"
                title="Ngoại lệ · hủy công việc"
                triggerLabel="Ngoại lệ · hủy task…"
                triggerVariant="danger-outline"
              >
                <CareNoteField label="Lý do (bắt buộc)" />
              </CareDialogAction>
            ) : null}
          </div>
        ) : null}
      </div>
    </CareCard>
  );
}

const eventLabels: Record<string, string> = {
  assign: "Chuyển người phụ trách",
  assign_student: "Phân công lâu dài",
  cancel: "Duyệt ngoại lệ",
  claim: "Nhận việc",
  coaching: "Liên kết Coaching",
  complete: "Hoàn thành",
  contact: "Ghi nhận liên hệ",
  create_followup: "Tạo việc theo dõi",
  monthly_created: "Tạo nghĩa vụ tháng",
  owner_unavailable: "Người phụ trách không còn đủ điều kiện",
  schedule: "Hẹn theo dõi",
  signal_withdrawn: "Cần rà soát bằng chứng",
  signals_updated: "Cập nhật cảnh báo",
};

const payloadLabels = {
  difficulties: "Khó khăn",
  note: "Nội dung",
  outcome: "Kết quả",
  plan: "Hướng hỗ trợ",
  strengths: "Tiến bộ",
} as const;

type CareEvent = CareDetail["events"][number];

/** Heading of one event: its label, plus channel · recipient · result for a contact and the rules for a signal update. */
export function getCareEventTitle(event: CareEvent): string {
  const label = eventLabels[event.event_type] ?? event.event_type;
  const payload = event.payload;
  if (event.event_type === "contact") {
    const parts = [
      typeof payload.channel === "string" ? channelLabels[payload.channel] : null,
      typeof payload.recipient === "string" ? recipientLabels[payload.recipient] : null,
      payload.success === true ? "đã trao đổi thực chất" : payload.success === false ? "chưa liên lạc được" : null,
    ].filter(Boolean);
    return parts.length ? `${label} · ${parts.join(" · ")}` : label;
  }
  if (event.event_type === "signals_updated" && payload.evidence && typeof payload.evidence === "object") {
    const rules = getCareRuleLabels(payload.evidence as Record<string, unknown>);
    return rules.length ? `${label} · ${rules.join(" · ")}` : label;
  }
  return label;
}

/** Newest first, by occurred_at (the RPC already orders them; this keeps the order if a caller does not). */
export function sortCareEvents(events: CareEvent[]): CareEvent[] {
  return [...events].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.id.localeCompare(a.id));
}

/** "Dòng thời gian": the student's care history (up to 200 events), newest first. */
export function CareTimeline({ events, taskId }: { events: CareEvent[]; taskId: string }) {
  const ordered = sortCareEvents(events);
  return (
    <CareCard title="Dòng thời gian">
      <p className="px-4 pt-3 text-caption text-text-muted">Tối đa 200 sự kiện gần nhất của học sinh; các liên hệ đủ điều kiện được chọn riêng ở phần hoàn thành.</p>
      {ordered.length === 0 ? (
        <p className="px-4 py-3 text-secondary text-text-muted">Chưa có sự kiện nào.</p>
      ) : (
        <ol aria-label="Dòng thời gian chăm sóc" className="grid px-4 py-3">
          {ordered.map((event, index) => (
            <li className="relative grid grid-cols-[12px_minmax(0,1fr)] gap-3 pb-3 last:pb-0" key={event.id}>
              <span aria-hidden="true" className="relative flex justify-center">
                <span className={cn("mt-1.5 h-2 w-2 rounded-full", index === 0 ? "bg-action-primary" : "bg-border-strong")} />
                {index < ordered.length - 1 ? <span className="absolute bottom-[-12px] top-4 w-px bg-border-subtle" /> : null}
              </span>
              <div className="min-w-0 text-secondary">
                <p className="font-semibold text-text-strong">{getCareEventTitle(event)}</p>
                <p className="tabular-nums text-text-muted">
                  {formatCareShortDateTime(event.occurred_at)} · {event.actor_name ?? "Hệ thống"}
                </p>
                {(Object.keys(payloadLabels) as (keyof typeof payloadLabels)[]).map((key) =>
                  typeof event.payload[key] === "string" && event.payload[key] ? (
                    <p className="whitespace-pre-wrap break-words text-text-default" key={key}>
                      {payloadLabels[key]}: {String(event.payload[key])}
                    </p>
                  ) : null,
                )}
                {typeof event.payload.next_followup_at === "string" ? (
                  <p className="tabular-nums text-text-default">Hẹn tiếp: {formatCareShortDateTime(event.payload.next_followup_at)}</p>
                ) : null}
                {event.task_id && event.task_id !== taskId ? (
                  <Link className="text-caption font-semibold text-action-link! hover:underline" href={`/student-care/${event.task_id}`}>
                    Xem công việc liên quan
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </CareCard>
  );
}

/** "Phiếu coaching liên quan": linked records, else the student's records available to link. */
export function CareCoachingCard({ detail }: { detail: CareDetail }) {
  return (
    <CareCard title="Phiếu coaching liên quan">
      <div className="grid gap-1.5 px-4 py-3 text-secondary">
        {detail.coaching.length > 0 ? (
          detail.coaching.map((coaching) => (
            <Link className="font-semibold text-action-link! hover:underline" href={`/coaching/${coaching.id}`} key={coaching.id}>
              {coaching.campaign_name}
            </Link>
          ))
        ) : (
          <p className="text-text-muted">
            Chưa gắn phiếu nào.
            {detail.available_coaching.length > 0 ? (
              <>
                {" "}Hồ sơ coaching có sẵn:{" "}
                {detail.available_coaching.map((coaching, index) => (
                  <span key={coaching.id}>
                    {index > 0 ? ", " : null}
                    <Link className="font-semibold text-action-link! hover:underline" href={`/coaching/${coaching.id}`}>
                      {coaching.campaign_name}
                    </Link>
                  </span>
                ))}
              </>
            ) : null}
          </p>
        )}
      </div>
    </CareCard>
  );
}

