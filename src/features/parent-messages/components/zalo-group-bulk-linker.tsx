"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow } from "@/components/patterns/data-table-frame";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { linkStudentZaloGroupsAction } from "@/features/parent-messages/actions";
import { StudentZaloGroupLinkDialog } from "@/features/parent-messages/components/student-zalo-group-link-dialog";
import type { ZaloLinkStudent } from "@/features/parent-messages/zalo-group-link-data";
import {
  MAX_BULK_ZALO_LINKS,
  normalizeForMatch,
  type GroupCandidate,
  type MatchConfidence,
  type MatchReason,
  type StudentGroupMatch,
} from "@/features/parent-messages/zalo-group-matching";

type Filter = MatchConfidence | "all";

const reasonLabel: Record<MatchReason, string> = {
  guardian_name: "Trùng tên phụ huynh",
  guardian_phone: "Có SĐT phụ huynh",
  student_code: "Trùng mã học sinh",
  student_name: "Trùng tên học sinh",
};

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded border-border-strong accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

function candidateLabel(candidate: GroupCandidate): string {
  const members = candidate.group.groupMembersCount === null ? "" : ` · ${candidate.group.groupMembersCount} thành viên`;
  return `${candidate.group.groupName ?? "(không tên)"}${members}`;
}

/**
 * Bulk "sổ liên lạc" linking: one row per unlinked studying student with the
 * group suggested from ZaloCRM group names. Sure matches start ticked; staff
 * pick for the rest (or search with the per-student dialog), then save in
 * chunks. Nothing is linked without the final "Liên kết" click.
 */
export function ZaloGroupBulkLinker({
  centerAccountId,
  linkAction = linkStudentZaloGroupsAction,
  matches,
  students,
}: {
  centerAccountId: string;
  /** The /dev/zalo-groups preview passes an inert stub. */
  linkAction?: typeof linkStudentZaloGroupsAction;
  matches: StudentGroupMatch[];
  students: ZaloLinkStudent[];
}) {
  const router = useRouter();
  const searchId = useId();
  const summaryId = useId();
  const matchByStudent = useMemo(() => new Map(matches.map((match) => [match.studentId, match])), [matches]);
  const [filter, setFilter] = useState<Filter>("sure");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries(matches.filter((match) => match.suggestion).map((match) => [match.studentId, match.suggestion!.group.externalThreadId])),
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set(matches.filter((match) => match.confidence === "sure").map((match) => match.studentId)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const result: Record<MatchConfidence, number> = { ambiguous: 0, none: 0, sure: 0 };
    for (const student of students) result[matchByStudent.get(student.id)?.confidence ?? "none"] += 1;
    return result;
  }, [matchByStudent, students]);

  const visible = useMemo(() => {
    const needle = normalizeForMatch(search);
    return students.filter((student) => {
      const confidence = matchByStudent.get(student.id)?.confidence ?? "none";
      if (filter !== "all" && confidence !== filter) return false;
      if (!needle) return true;
      return normalizeForMatch(`${student.fullName} ${student.publicCode} ${student.classCodes.join(" ")}`).includes(needle);
    });
  }, [filter, matchByStudent, search, students]);

  // Thread id → students that currently pick it (a group can only go to one student).
  const pickedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const studentId of checked) {
      const threadId = chosen[studentId];
      if (!threadId) continue;
      map.set(threadId, [...(map.get(threadId) ?? []), studentId]);
    }
    return map;
  }, [checked, chosen]);

  const ready = [...checked].filter((studentId) => chosen[studentId]);
  const duplicates = [...pickedBy.values()].filter((ids) => ids.length > 1).length;
  const visibleSelectable = visible.filter((student) => chosen[student.id]);
  const allVisibleChecked = visibleSelectable.length > 0 && visibleSelectable.every((student) => checked.has(student.id));

  const toggle = (studentId: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setChecked((current) => {
      const next = new Set(current);
      for (const student of visibleSelectable) {
        if (allVisibleChecked) next.delete(student.id);
        else next.add(student.id);
      }
      return next;
    });
  };

  const choose = (studentId: string, threadId: string) => {
    setChosen((current) => ({ ...current, [studentId]: threadId }));
    setChecked((current) => {
      const next = new Set(current);
      if (threadId) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  const save = () => {
    if (isPending || ready.length === 0 || duplicates > 0) return;
    setBanner(null);
    const links = ready.map((studentId) => {
      const candidate = matchByStudent.get(studentId)?.candidates.find((item) => item.group.externalThreadId === chosen[studentId]);
      return {
        groupName: candidate?.group.groupName ?? null,
        studentId,
        threadId: chosen[studentId],
        zaloAccountId: candidate?.group.zaloAccountId || centerAccountId,
      };
    });
    startTransition(async () => {
      let linked = 0;
      const failed: Record<string, string> = {};
      for (let index = 0; index < links.length; index += MAX_BULK_ZALO_LINKS) {
        const chunk = links.slice(index, index + MAX_BULK_ZALO_LINKS);
        setProgress(`Đang liên kết ${Math.min(index + chunk.length, links.length)}/${links.length} học sinh…`);
        const result = await linkAction({ links: chunk }).catch(() => ({
          message: "Mất kết nối tới máy chủ. Kiểm tra mạng rồi bấm Liên kết lại.",
          ok: false as const,
        }));
        if (!result.ok) {
          for (const link of chunk) failed[link.studentId] = result.message;
          continue;
        }
        for (const row of result.results) {
          if (row.ok) linked += 1;
          else failed[row.studentId] = row.message;
        }
      }
      setProgress(null);
      setErrors(failed);
      setChecked(new Set(Object.keys(failed)));
      const failedCount = Object.keys(failed).length;
      setBanner({
        message:
          failedCount === 0
            ? `Đã liên kết ${linked} học sinh với nhóm sổ liên lạc.`
            : `Đã liên kết ${linked} học sinh; ${failedCount} học sinh chưa liên kết được (xem lý do ở từng dòng).`,
        ok: failedCount === 0,
      });
      router.refresh();
    });
  };

  return (
    <section aria-labelledby={`${summaryId}-title`} className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-section-title font-semibold text-text-strong" id={`${summaryId}-title`}>
            Học sinh chưa liên kết ({students.length})
          </h2>
          <p className="mt-1 text-secondary text-text-muted">
            Gợi ý lấy từ tên nhóm hiện tại trên ZaloCRM. Dòng &quot;Chắc chắn&quot; đã được chọn sẵn; kiểm tra rồi bấm Liên kết. Dòng
            &quot;Cần chọn&quot; có nhiều nhóm giống nhau (anh em, trùng tên), hãy bấm Tìm nhóm để xem thành viên.
          </p>
        </div>
        <div className="grid min-w-[220px] gap-1.5">
          <Label htmlFor={searchId}>Tìm học sinh</Label>
          <Input id={searchId} maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã học sinh, mã lớp" value={search} />
        </div>
      </div>

      <QuickFilterChips<Filter>
        chips={[
          { count: counts.sure, label: "Chắc chắn", value: "sure" },
          { count: counts.ambiguous, label: "Cần chọn", value: "ambiguous" },
          { count: counts.none, label: "Không tìm thấy", value: "none" },
          { count: students.length, label: "Tất cả", separatorBefore: true, value: "all" },
        ]}
        disableEmpty={false}
        label="Lọc theo mức gợi ý"
        onChange={setFilter}
        value={filter}
      />

      {banner ? <ResultBanner title={banner.message} tone={banner.ok ? "success" : "warning"} /> : null}

      <div aria-live="polite" className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-2.5" id={summaryId}>
        <p className="text-secondary text-text-strong">
          Đã chọn <strong>{ready.length}</strong> học sinh có nhóm
          {duplicates > 0 ? <span className="text-danger"> · {duplicates} nhóm đang được chọn cho nhiều học sinh</span> : null}
        </p>
        {progress ? <p className="text-secondary text-text-muted">{progress}</p> : null}
        <Button className="ml-auto max-md:h-11" disabled={isPending || ready.length === 0 || duplicates > 0} isLoading={isPending} onClick={save} size="sm" type="button">
          Liên kết {ready.length} học sinh
        </Button>
      </div>

      <DataTableFrame
        body={visible.map((student) => {
          const match = matchByStudent.get(student.id);
          const candidates = match?.candidates ?? [];
          const threadId = chosen[student.id] ?? "";
          const isChecked = checked.has(student.id);
          const shared = threadId && isChecked ? (pickedBy.get(threadId)?.length ?? 0) > 1 : false;
          const current = candidates.find((candidate) => candidate.group.externalThreadId === threadId);
          const error = errors[student.id];
          return (
            <TableRow key={student.id} selected={isChecked} tall>
              <TableCell className="w-12">
                <input
                  aria-label={`Chọn ${student.fullName}`}
                  checked={isChecked}
                  className={checkboxClassName}
                  disabled={!threadId || isPending}
                  onChange={() => toggle(student.id)}
                  type="checkbox"
                />
              </TableCell>
              <TableCell className="min-w-[200px] py-2">
                <p className="font-semibold text-text-strong">{student.fullName}</p>
                <p className="text-caption text-text-muted">
                  {student.publicCode} · sinh {student.birthYear}
                  {student.classCodes.length > 0 ? ` · ${student.classCodes.join(", ")}` : ""}
                </p>
              </TableCell>
              <TableCell className="min-w-[180px] py-2 text-caption text-text-default">{student.guardianSummary || "—"}</TableCell>
              <TableCell className="min-w-[340px] py-2">
                <div className="grid gap-1.5">
                  {candidates.length > 0 ? (
                    <Select
                      aria-label={`Nhóm Zalo cho ${student.fullName}`}
                      disabled={isPending}
                      onChange={(event) => choose(student.id, event.target.value)}
                      value={threadId}
                    >
                      <option value="">— Chưa chọn —</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.group.externalThreadId} value={candidate.group.externalThreadId}>
                          {candidateLabel(candidate)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-caption text-text-muted">Không có nhóm nào khớp tên.</p>
                  )}
                  {shared ? <p className="text-caption text-danger">Nhóm này đang được chọn cho học sinh khác.</p> : null}
                  {error ? <p className="text-caption text-danger">{error}</p> : null}
                  {match?.confidence !== "sure" ? (
                    <StudentZaloGroupLinkDialog
                      centerAccountId={centerAccountId}
                      configured
                      currentThreadId={null}
                      currentZaloAccountId={null}
                      studentId={student.id}
                      studentName={student.fullName}
                      triggerLabel="Tìm nhóm"
                      triggerVariant="ghost"
                    />
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-2">
                <div className="flex flex-wrap gap-1">
                  {(current ?? candidates[0])?.reasons.map((reason) => (
                    <Badge key={reason} tone={reason === "student_code" || reason === "student_name" ? "success" : "neutral"}>
                      {reasonLabel[reason]}
                    </Badge>
                  )) ?? null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        caption="Học sinh chưa liên kết nhóm Zalo sổ liên lạc"
        empty={<p className="px-4 py-6 text-secondary text-text-muted">Không có học sinh nào trong mục này.</p>}
        header={
          <tr>
            <TableHeaderCell className="w-12">
              <input
                aria-describedby={summaryId}
                aria-label="Chọn tất cả học sinh đang hiển thị có nhóm"
                checked={allVisibleChecked}
                className={checkboxClassName}
                disabled={visibleSelectable.length === 0 || isPending}
                onChange={toggleAllVisible}
                type="checkbox"
              />
            </TableHeaderCell>
            <TableHeaderCell>Học sinh</TableHeaderCell>
            <TableHeaderCell>Phụ huynh</TableHeaderCell>
            <TableHeaderCell>Nhóm Zalo</TableHeaderCell>
            <TableHeaderCell>Căn cứ</TableHeaderCell>
          </tr>
        }
        status={visible.length === 0 ? "empty" : "ready"}
      />
    </section>
  );
}
