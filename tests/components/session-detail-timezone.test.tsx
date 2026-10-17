// Value: protects=the session page's server HTML carries the Vietnam business date whatever zone the server runs in, so
// a UTC server (Vercel) and a Vietnam browser render the same text and hydration does not fail (React #418);
// fails_when=a component on the page formats `sessionDate` with the runtime's default zone (the lifecycle card showed
// "27/11/2026" for a 28/11 session when rendered in UTC);
// seam=server actions and next/navigation mocked, react-dom/server renderToString with process.env.TZ switched per
// case (Node applies it at once); no_claim=does not hydrate in a browser (checked by hand on /dev/session under TZ=UTC)
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionDetailReadModel, SessionParticipantReadModel } from "@/features/sessions/detail-read-models";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/sessions/actions/session-attendance-actions", () => ({ markSessionAttendanceAction: vi.fn(), updateSessionAttendanceAction: vi.fn() }));
vi.mock("@/features/sessions/actions/session-result-actions", () => ({ lockSessionAction: vi.fn(), recordSessionResultAction: vi.fn(), updateSessionResultAction: vi.fn() }));
vi.mock("@/features/sessions/actions/session-lifecycle-actions", () => ({ cancelSessionAction: vi.fn(), completeSessionAction: vi.fn(), rescheduleSessionAction: vi.fn(), startSessionAction: vi.fn() }));

import { SessionDetailPage } from "@/features/sessions/session-detail-page";

afterEach(() => {
  vi.unstubAllEnvs();
});

const participant: SessionParticipantReadModel = {
  actualLearningMode: "offline", attendanceId: null, attendanceNotes: null, attendanceStatus: null, currentGrade: 3, enrollmentClassId: "class-3b", enrollmentId: "enrollment-1", isLateUpdate: false, notebookScore: null, notebookStatus: null, registeredMode: "offline", resultComment: null, resultId: null, studentCode: "HV-001", studentId: "student-1", studentName: "Nguyễn Minh An", testScore: null,
};

/** A future scheduled session, as on production: 3B, Thứ Bảy 28/11/2026 13:00–14:30. */
const scheduledDetail: SessionDetailReadModel = {
  attendanceCount: null, cancellationReason: null, cancelledAt: null, classCode: "3B", classId: "class-3b", className: "Toán 3B", classStatus: "active", completedAt: null, componentCode: null, endTime: "14:30:00", grade: 3, id: "session-3b", learningMode: "offline", level: "B", lockedAt: null, lockReason: null, meetingUrl: null, notes: null, participants: [participant], previousSessionDate: "2026-11-21", rescheduleCount: 1, resultCount: null, roomName: "P. 201", rosterCount: null, sessionDate: "2026-11-28", sessionKind: "regular", startedAt: null, startTime: "13:00:00", status: "scheduled",
};

/** Minutes from local time to UTC, as `Date#getTimezoneOffset` reports them. */
const zoneOffsets = { "Asia/Ho_Chi_Minh": -420, UTC: 0 } as const;

function renderPageIn(zone: keyof typeof zoneOffsets): string {
  vi.stubEnv("TZ", zone);
  // Guard: the switch must reach Date and Intl, or both renders would run in the runner's own zone.
  expect(new Date("2026-11-28T00:00:00Z").getTimezoneOffset()).toBe(zoneOffsets[zone]);
  return renderToString(
    <SessionDetailPage
      additionalStudyCandidates={[]}
      canLockSession
      canManageResults
      canManageSessions
      canMarkAttendance
      canViewAttendance
      canViewResults
      canViewStudents
      detail={scheduledDetail}
    />,
  );
}

/** Visible text of the server HTML, without React's `<!-- -->` text separators. */
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("Session detail page renders Vietnam dates on a UTC server", () => {
  it("shows the session's Vietnam date in the header, the lifecycle card and the info card under TZ=UTC", () => {
    const text = textOf(renderPageIn("UTC"));

    expect(text).toContain("Thứ Bảy, 28/11/2026 · 13:00–14:30");
    expect(text).toContain("3B · 28/11/2026");
    expect(text).toContain("Đã dời 1 lần, lần gần nhất từ ngày 21/11/2026.");
    expect(text).not.toContain("27/11/2026");
  });

  it("renders the same HTML on a UTC server as in Vietnam time, so hydration finds no text mismatch", () => {
    const utcHtml = renderPageIn("UTC");
    const vietnamHtml = renderPageIn("Asia/Ho_Chi_Minh");

    expect(utcHtml).toBe(vietnamHtml);
  });
});
