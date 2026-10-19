"use client";

import { AppShell } from "@/components/layout/app-shell";
import { UnmatchedSubmissionsPage } from "@/features/grading-submissions/components/unmatched-submissions-page";
import type { UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

const items: UnmatchedGradingSubmission[] = [
  {
    answerText: "13.18 14.8 15.257",
    answerTruncated: false,
    claimedBirthYear: 2014,
    claimedClassOption: "CLC1 - Từ cơ bản đến nâng cao - Thầy Vinh",
    claimedClassOptionOther: null,
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
      <UnmatchedSubmissionsPage items={empty ? [] : items} limit={200} />
    </AppShell>
  );
}
