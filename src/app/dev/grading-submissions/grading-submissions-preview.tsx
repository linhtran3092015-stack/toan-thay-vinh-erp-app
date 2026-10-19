"use client";

import { AppShell } from "@/components/layout/app-shell";
import type { GradingReviewActions } from "@/features/grading-submissions/components/review-actions";
import { UnmatchedSubmissionsPage } from "@/features/grading-submissions/components/unmatched-submissions-page";
import type { UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import type { MatchCandidateStudent } from "@/features/grading-submissions/review";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

const items: UnmatchedGradingSubmission[] = [
  {
    answerText: "13.18 14.8 15.257",
    answerTruncated: false,
    claimedBirthYear: 2014,
    claimedClassOption: "CLC1 - Từ cơ bản đến nâng cao - Thầy Vinh",
    claimedClassOptionOther: null,
    claimedClassSessionId: null,
    claimedFullName: "Nguyễn Minh Anh",
    claimedSessionLabel: null,
    claimedStudentCode: null,
    id: "sub-1",
    issues: ["student_ambiguous"],
    receivedAt: "2026-10-18T12:35:04Z",
    student: null,
    submittedAt: "2026-10-18T12:35:00Z",
  },
  {
    answerText: "Câu 1: 54\nCâu 2: 4,7 cm\nCâu 3: 2,8",
    answerTruncated: false,
    claimedBirthYear: 2013,
    claimedClassOption: "Khác",
    claimedClassOptionOther: "Lớp học bù chiều thứ 7",
    claimedClassSessionId: null,
    claimedFullName: "Trần Gia Bảo",
    claimedSessionLabel: null,
    claimedStudentCode: null,
    id: "sub-2",
    issues: ["student_not_found"],
    receivedAt: "2026-10-18T10:02:10Z",
    student: null,
    submittedAt: "2026-10-18T10:02:00Z",
  },
  {
    answerText: "x=54;x=8",
    answerTruncated: false,
    claimedBirthYear: 2015,
    claimedClassOption: null,
    claimedClassOptionOther: null,
    claimedClassSessionId: "00000000-0000-4000-8000-000000000603",
    claimedFullName: "Lê Hoàng Nam",
    claimedSessionLabel: "6B · 15:00",
    claimedStudentCode: "TV-2026-00098",
    id: "sub-3",
    issues: ["outside_window"],
    receivedAt: "2026-10-17T16:40:00Z",
    student: { fullName: "Lê Hoàng Nam", id: "student-3", publicCode: "TV-2026-00098" },
    submittedAt: "2026-10-17T16:40:00Z",
  },
];

function session(id: string, classCode: string, classLevel: string, startTime: string, endTime: string, sessionDate: string, attendanceStatus: string | null, onRoster = true) {
  return { attendanceStatus, classCode, classLevel, classSessionId: id, endTime, onRoster, sessionDate, startTime };
}

const candidates: MatchCandidateStudent[] = [
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Nguyễn Minh Anh",
    id: "student-1",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00011",
    sessions: [session("00000000-0000-4000-8000-000000000601", "7CLC1", "CLC", "18:00:00", "19:30:00", "2026-10-18", "present")],
  },
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Nguyễn Minh Anh",
    id: "student-2",
    lifecycleStatus: "active",
    nickname: "Bông",
    publicCode: "TV-2026-00012",
    sessions: [
      session("00000000-0000-4000-8000-000000000602", "7B", "B", "15:00:00", "16:30:00", "2026-10-18", "additional_study", false),
      session("00000000-0000-4000-8000-000000000601", "7CLC1", "CLC", "18:00:00", "19:30:00", "2026-10-18", null),
    ],
  },
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Phạm Gia Huy",
    id: "student-4",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00014",
    sessions: [],
  },
  {
    birthYear: 2015,
    enrolledOnDay: true,
    fullName: "Lê Hoàng Nam",
    id: "student-3",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00098",
    sessions: [session("00000000-0000-4000-8000-000000000603", "6B", "B", "15:00:00", "16:30:00", "2026-10-17", "present")],
  },
];

const wait = () => new Promise((resolve) => setTimeout(resolve, 400));

/** Fixture stand-ins: nothing is written. */
const previewActions: GradingReviewActions = {
  ignore: async () => {
    await wait();
    return { message: "Đã bỏ qua bài (bài rác).", ok: true };
  },
  loadCandidates: async ({ query, submissionId }) => {
    await wait();
    if (query) {
      const wanted = query.toLowerCase();
      return { ok: true, students: candidates.filter((student) => student.fullName.toLowerCase().includes(wanted)) };
    }
    const birthYear = items.find((item) => item.id === submissionId)?.claimedBirthYear;
    return { ok: true, students: candidates.filter((student) => student.birthYear === birthYear) };
  },
  match: async () => {
    await wait();
    return { message: "Đã ghép bài vào buổi học.", ok: true };
  },
  rematch: async () => {
    await wait();
    const summary = { failed: 0, invalid: 0, matched: 1, skipped: 0, total: 3, unchanged: 2, updated: 0 };
    return { message: "Đã ghép thêm 1 bài. 2 bài vẫn cần chọn tay.", ok: true, summary };
  },
};

export function GradingSubmissionsPreview({ empty }: { empty: boolean }) {
  return (
    <AppShell
      authUser={{ displayName: "Lê Bích Ngọc", email: "ngoc@example.com", id: "dev-user", initials: "LN" }}
      canCheckTimekeeping
      centerDisplayName="Toán Thầy Vinh"
      permissions={DATABASE_PERMISSION_CODES}
      previewPathname="/grading-submissions"
      unreadNotificationCount={0}
    >
      <UnmatchedSubmissionsPage actions={previewActions} items={empty ? [] : items} limit={200} />
    </AppShell>
  );
}
