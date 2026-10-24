"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import {
  checkStudentZaloGroupAction,
  linkStudentZaloGroupAction,
  searchZaloGroupsAction,
  unlinkStudentZaloGroupAction,
  type ZaloGroupSearchResult,
} from "@/features/parent-messages/actions";

type GroupHit = Extract<ZaloGroupSearchResult, { ok: true }>["groups"][number];

export function StudentZaloGroupLinkDialog({
  configured,
  currentThreadId,
  studentId,
  onLinked,
  studentName,
  triggerLabel,
  triggerVariant,
}: {
  configured: boolean;
  currentThreadId: string | null;
  /** Bulk page: the row disappears on refresh, so the table shows the result instead. */
  onLinked?: (message: string) => void;
  studentId: string;
  studentName: string;
  /** The bulk link table uses a short ghost "Tìm nhóm" per row instead of the profile's primary button. */
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(studentName);
  const [groups, setGroups] = useState<GroupHit[]>([]);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [checkText, setCheckText] = useState<string | null>(null);
  const [unlinkReason, setUnlinkReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const runSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await searchZaloGroupsAction({ search, withMembers: true });
      if (!result.ok) {
        setFeedback({ message: result.message, ok: false });
        return;
      }
      setGroups(result.groups);
      setTotal(result.total);
    });
  };

  const open = () => {
    setFeedback(null);
    setCheckText(null);
    setGroups([]);
    setSearch(studentName);
    setIsOpen(true);
  };

  const close = () => {
    if (!isPending) setIsOpen(false);
  };

  const link = (group: GroupHit) => {
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await linkStudentZaloGroupAction({
        groupName: group.groupName,
        studentId,
        threadId: group.externalThreadId,
      }).catch(() => ({ message: "Mất kết nối tới máy chủ. Tải lại trang để xem nhóm đã được liên kết chưa.", ok: false as const }));
      setFeedback(result);
      if (result.ok) {
        setIsOpen(false);
        onLinked?.(`${studentName}: ${result.message}`);
        router.refresh();
      }
    });
  };

  const check = () => {
    if (!currentThreadId || isPending) return;
    setCheckText(null);
    startTransition(async () => {
      const result = await checkStudentZaloGroupAction({ studentId });
      if (!result.ok) {
        setCheckText(`Không kiểm tra được: ${result.message}`);
        return;
      }
      setCheckText(
        result.present
          ? `Nhóm vẫn còn: "${result.groupName ?? "không tên"}" · ${result.membersCount ?? "?"} thành viên · nick ${result.accountStatus === "connected" ? "đang kết nối" : `trạng thái ${result.accountStatus ?? "không rõ"}`}.`
          : "Không tìm thấy nhóm với mã này trên nick trung tâm. Nick có thể đã rời nhóm hoặc nhóm đã giải tán.",
      );
    });
  };

  const unlink = () => {
    if (isPending || unlinkReason.trim().length < 2) return;
    startTransition(async () => {
      const result = await unlinkStudentZaloGroupAction({ reason: unlinkReason, studentId });
      setFeedback(result);
      if (result.ok) {
        setUnlinkReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label={triggerLabel ? `${triggerLabel} cho ${studentName}` : undefined}
          disabled={!configured}
          onClick={open}
          ref={triggerRef}
          size="sm"
          type="button"
          variant={triggerVariant ?? (currentThreadId ? "outline" : "primary")}
        >
          {triggerLabel ?? (currentThreadId ? "Đổi nhóm" : "Liên kết nhóm sổ liên lạc")}
        </Button>
        {currentThreadId ? (
          <Button disabled={!configured || isPending} onClick={check} size="sm" type="button" variant="ghost">
            Kiểm tra liên kết
          </Button>
        ) : null}
      </div>
      {!configured ? <p className="text-caption text-text-muted">Chưa cấu hình kết nối ZaloCRM trên máy chủ.</p> : null}
      {checkText ? <p className="text-caption text-text-muted">{checkText}</p> : null}
      {currentThreadId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" disabled={isPending} maxLength={500} onChange={(event) => setUnlinkReason(event.target.value)} placeholder="Lý do gỡ liên kết" value={unlinkReason} />
          <Button disabled={isPending || unlinkReason.trim().length < 2} onClick={unlink} size="sm" type="button" variant="danger">
            Gỡ liên kết
          </Button>
        </div>
      ) : null}
      {feedback && !isOpen ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} /> : null}

      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-2xl" initialFocusRef={searchRef} isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>Liên kết nhóm sổ liên lạc cho {studentName}</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>
              Tìm nhóm theo tên hiện tại trên ZaloCRM. Hệ thống lưu mã nhóm (không đổi khi đổi tên); với anh em ruột, đối chiếu thành viên để chọn đúng nhóm.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={runSearch}>
            <div className="grid min-w-[240px] flex-1 gap-1.5">
              <Label htmlFor={searchId}>Tên nhóm hoặc tên phụ huynh</Label>
              <Input disabled={isPending} id={searchId} maxLength={100} onChange={(event) => setSearch(event.target.value)} ref={searchRef} value={search} />
            </div>
            <Button disabled={isPending} isLoading={isPending} type="submit" variant="secondary">Tìm nhóm</Button>
          </form>
          {feedback && isOpen ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} /> : null}
          {groups.length > 0 ? (
            <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
              {groups.map((group) => (
                <li className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border-subtle bg-surface-sunken p-3" key={group.id}>
                  <div className="min-w-0">
                    <p className="font-semibold text-text-strong">
                      {group.groupName ?? "(không tên)"}
                      {group.externalThreadId === currentThreadId ? <Badge tone="info">Đang liên kết</Badge> : null}
                    </p>
                    <p className="text-caption text-text-muted">
                      {group.groupMembersCount ?? "?"} thành viên · mã {group.externalThreadId}
                    </p>
                    {group.members && group.members.length > 0 ? (
                      <p className="mt-1 text-caption text-text-default">
                        Thành viên: {group.members.map((member) => member.displayName ?? member.zaloName ?? member.memberUid).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <Button disabled={isPending || group.externalThreadId === currentThreadId} onClick={() => link(group)} size="sm" type="button">
                    {/* Saves at once (unlike the bulk table's picker, which only stages a choice). */}
                    Liên kết nhóm này
                  </Button>
                </li>
              ))}
              {total > groups.length ? <li className="text-caption text-text-muted">Còn {total - groups.length} nhóm khác, hãy thu hẹp từ khóa.</li> : null}
            </ul>
          ) : (
            <p className="text-secondary text-text-muted">Nhập từ khóa rồi bấm Tìm nhóm.</p>
          )}
          <div className="flex justify-end">
            <Button disabled={isPending} onClick={close} type="button" variant="outline">Đóng</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
