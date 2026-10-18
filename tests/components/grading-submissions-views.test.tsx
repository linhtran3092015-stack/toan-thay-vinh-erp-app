import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionSubmissionsCard } from "@/features/grading-submissions/components/session-submissions-card";
import { UnmatchedSubmissionsPage } from "@/features/grading-submissions/components/unmatched-submissions-page";
import type { SessionGradingSubmission, UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import type { SessionParticipantReadModel } from "@/features/sessions/detail-read-models";

afterEach(() => {
  cleanup();
});

function participant(overrides: Partial<SessionParticipantReadModel>): SessionParticipantReadModel {
  return {
    actualLearningMode: "offline",
    attendanceId: "att",
    attendanceNotes: null,
    attendanceStatus: "present",
    currentGrade: 7,
    enrollmentClassId: null,
    enrollmentId: null,
    isLateUpdate: false,
    notebookScore: null,
    notebookStatus: null,
    registeredMode: "offline",
    resultComment: null,
    resultId: null,
    studentCode: "TV-2026-00001",
    studentId: "s1",
    studentName: "Lê Văn An",
    testScore: null,
    ...overrides,
  };
}

function submission(overrides: Partial<SessionGradingSubmission>): SessionGradingSubmission {
  return {
    answerText: "13. x=18\n14. 8",
    answerTruncated: false,
    attemptNo: 1,
    countsForScore: true,
    id: "sub-1",
    issues: [],
    sessionMatchMethod: "claimed_session",
    studentCode: "TV-2026-00001",
    studentId: "s1",
    studentMatchMethod: "student_code",
    studentName: "Lê Văn An",
    submittedAt: "2026-10-18T12:35:00Z",
    ...overrides,
  };
}

describe("SessionSubmissionsCard", () => {
  it("shows the counted attempt, folds earlier ones and lists present students without a submission", () => {
    render(
      <SessionSubmissionsCard
        canViewStudents
        participants={[
          participant({}),
          participant({ studentCode: "TV-2026-00002", studentId: "s2", studentName: "Trần Thị Bình" }),
          participant({ attendanceStatus: "unexcused_absence", studentCode: "TV-2026-00003", studentId: "s3", studentName: "Phạm Văn Cường" }),
        ]}
        result={{
          data: [
            submission({ attemptNo: 2, id: "sub-2", submittedAt: "2026-10-18T12:38:00Z" }),
            submission({ answerText: "13. 17", attemptNo: 1, countsForScore: false, id: "sub-1" }),
            submission({ id: "sub-3", issues: ["outside_window"], studentCode: "TV-2026-00003", studentId: "s3", studentName: "Phạm Văn Cường" }),
          ],
          ok: true,
        }}
      />,
    );

    expect(screen.getByText("2 học sinh đã nộp · 1/2 em có mặt đã nộp")).toBeInTheDocument();
    expect(screen.getByText("Lần nộp 2")).toBeInTheDocument();
    expect(screen.getByText("1 lần nộp trước (không tính)")).toBeInTheDocument();
    // Submission time in Vietnam time, whatever the test runner's zone.
    expect(screen.getAllByText(/19:38/).length).toBeGreaterThan(0);
    const cuong = screen.getByText("Phạm Văn Cường").closest("li");
    expect(cuong).not.toBeNull();
    expect(within(cuong as HTMLElement).getByText("Vắng nhưng có bài")).toBeInTheDocument();
    expect(within(cuong as HTMLElement).getByText("Nộp ngoài giờ buổi học")).toBeInTheDocument();
    expect(screen.getByText("Có mặt nhưng chưa nộp (1)")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị Bình")).toBeInTheDocument();
  });

  it("masks names and codes like the rest of the session page without students.view", () => {
    render(
      <SessionSubmissionsCard
        canViewStudents={false}
        participants={[participant({})]}
        result={{ data: [submission({}), submission({ id: "sub-x", studentCode: "TV-2026-00077", studentId: "s-x", studentName: "Ngô Văn Ngoài" })], ok: true }}
      />,
    );
    expect(screen.getByText("Học viên 1")).toBeInTheDocument();
    expect(screen.getByText("Học viên ngoài danh sách")).toBeInTheDocument();
    expect(screen.queryByText("Lê Văn An")).toBeNull();
    expect(screen.queryByText("TV-2026-00077")).toBeNull();
  });

  it("shows the load error instead of the list", () => {
    render(<SessionSubmissionsCard canViewStudents participants={[]} result={{ error: "Không tải được bài nộp của buổi học.", ok: false }} />);
    expect(screen.getByText("Không tải được bài nộp của buổi học.")).toBeInTheDocument();
  });
});

describe("UnmatchedSubmissionsPage", () => {
  const item: UnmatchedGradingSubmission = {
    answerText: "13. 18",
    answerTruncated: false,
    claimedBirthYear: 2014,
    claimedClassOption: "Khác",
    claimedClassOptionOther: "Lớp cô Hương",
    claimedFullName: "Nguyễn Minh Anh",
    claimedSessionLabel: null,
    claimedStudentCode: null,
    id: "sub-9",
    issues: ["student_ambiguous"],
    receivedAt: "2026-10-18T12:35:05Z",
    student: null,
    submittedAt: "2026-10-18T12:35:00Z",
  };

  it("lists what the form claimed and why it was not matched", () => {
    render(<UnmatchedSubmissionsPage items={[item]} limit={200} />);
    expect(screen.getByText("Nguyễn Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("Trùng họ tên, chưa biết em nào")).toBeInTheDocument();
    expect(screen.getByText("Khác: Lớp cô Hương")).toBeInTheDocument();
    expect(screen.getByText("Bài làm (6 ký tự)")).toBeInTheDocument();
  });

  it("links the student when only the session is missing", () => {
    render(
      <UnmatchedSubmissionsPage
        items={[{ ...item, claimedSessionLabel: "7CLC1 · 18:00", issues: ["outside_window"], student: { fullName: "Nguyễn Minh Anh", id: "s1", publicCode: "TV-2026-00001" } }]}
        limit={200}
      />,
    );
    expect(screen.getByRole("link", { name: "Nguyễn Minh Anh" })).toHaveAttribute("href", "/students/s1");
    expect(screen.getByText("Buổi 7CLC1 · 18:00")).toBeInTheDocument();
  });

  it("says so when everything is matched", () => {
    render(<UnmatchedSubmissionsPage items={[]} limit={200} />);
    expect(screen.getByText("Không có bài chưa ghép")).toBeInTheDocument();
  });
});
