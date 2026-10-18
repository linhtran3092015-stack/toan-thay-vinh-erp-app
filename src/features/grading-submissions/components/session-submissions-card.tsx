import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionAnswer } from "@/features/grading-submissions/components/submission-answer";
import type { GradingDataResult, SessionGradingSubmission } from "@/features/grading-submissions/data";
import { matchIssueLabel } from "@/features/grading-submissions/matching";
import type { SessionParticipantReadModel } from "@/features/sessions/detail-read-models";
import { getParticipantDisplayName } from "@/features/sessions/lock-readiness";
import { formatDateTime } from "@/lib/datetime";

const PRESENT = new Set(["additional_study", "present"]);

const sessionMethodLabels: Record<string, string> = {
  attendance: "theo điểm danh",
  claimed_session: "học sinh chọn buổi trên form",
  class_option: "theo lớp chọn trên form",
  manual: "ghép tay",
  time_window: "theo giờ nộp",
};

/**
 * "Cuối giờ · Kết quả" → read-only list of what students submitted through the form for this
 * session (Giai đoạn 1). The latest attempt counts; earlier ones fold under it. Students marked
 * present without a counted submission are listed as "Chưa nộp".
 */
export function SessionSubmissionsCard({
  canViewStudents,
  participants,
  result,
}: {
  canViewStudents: boolean;
  participants: SessionParticipantReadModel[];
  result: GradingDataResult<SessionGradingSubmission[]>;
}) {
  if (!result.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bài nộp qua form</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultBanner description={result.error} title="Không tải được bài nộp" tone="danger" />
        </CardContent>
      </Card>
    );
  }

  const counted = result.data.filter((submission) => submission.countsForScore);
  const earlierByStudent = new Map<string, SessionGradingSubmission[]>();
  for (const submission of result.data) {
    if (submission.countsForScore) continue;
    earlierByStudent.set(submission.studentId, [...(earlierByStudent.get(submission.studentId) ?? []), submission]);
  }
  const participantById = new Map(participants.map((participant) => [participant.studentId, participant]));
  // Same masking as the rest of the session page when the viewer cannot see students.
  const displayName = (submission: SessionGradingSubmission) => {
    if (canViewStudents) return submission.studentName;
    const participant = participantById.get(submission.studentId);
    return participant ? getParticipantDisplayName(participant, participants, false) : "Học viên ngoài danh sách";
  };
  const submittedIds = new Set(counted.map((submission) => submission.studentId));
  const missing = participants.filter(
    (participant) => participant.attendanceStatus !== null && PRESENT.has(participant.attendanceStatus) && !submittedIds.has(participant.studentId),
  );
  const presentCount = participants.filter(
    (participant) => participant.attendanceStatus !== null && PRESENT.has(participant.attendanceStatus),
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài nộp qua form</CardTitle>
        <p className="text-secondary text-text-muted">
          Bài học sinh gõ trên form cuối buổi, ERP tự ghép vào buổi này. Nộp nhiều lần thì lần cuối được tính. Chỉ để xem; chấm
          bài vẫn nhập ở phần kết quả bên dưới.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-secondary text-text-default">
          {counted.length} học sinh đã nộp
          {presentCount > 0 ? ` · ${presentCount - missing.length}/${presentCount} em có mặt đã nộp` : ""}
        </p>

        {counted.length === 0 ? (
          <p className="text-secondary text-text-muted">Chưa có bài nộp nào được ghép vào buổi này.</p>
        ) : (
          <ul className="grid gap-3">
            {counted.map((submission) => {
              const attendance = participantById.get(submission.studentId)?.attendanceStatus ?? null;
              const earlier = earlierByStudent.get(submission.studentId) ?? [];
              return (
                <li className="grid gap-2 rounded-lg border border-border-subtle p-3" key={submission.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-strong">{displayName(submission)}</span>
                    {canViewStudents ? <span className="text-caption text-text-muted">{submission.studentCode}</span> : null}
                    <span className="text-caption text-text-muted">· nộp {formatDateTime(submission.submittedAt)}</span>
                    {submission.attemptNo && submission.attemptNo > 1 ? <Badge tone="info">Lần nộp {submission.attemptNo}</Badge> : null}
                    {attendance === null ? <Badge tone="warning">Chưa điểm danh</Badge> : null}
                    {attendance !== null && !PRESENT.has(attendance) ? <Badge tone="warning">Vắng nhưng có bài</Badge> : null}
                    {submission.issues.map((issue) => (
                      <Badge key={issue} tone="warning">
                        {matchIssueLabel(issue)}
                      </Badge>
                    ))}
                  </div>
                  {submission.sessionMatchMethod ? (
                    <p className="text-caption text-text-muted">Ghép {sessionMethodLabels[submission.sessionMatchMethod] ?? submission.sessionMatchMethod}</p>
                  ) : null}
                  <SubmissionAnswer text={submission.answerText} truncated={submission.answerTruncated} />
                  {earlier.length > 0 ? (
                    <details className="text-caption text-text-muted">
                      <summary className="cursor-pointer">{earlier.length} lần nộp trước (không tính)</summary>
                      <ul className="mt-2 grid gap-2">
                        {earlier.map((attempt) => (
                          <li className="grid gap-1" key={attempt.id}>
                            <span>
                              Lần {attempt.attemptNo ?? "?"} · {formatDateTime(attempt.submittedAt)}
                            </span>
                            <SubmissionAnswer text={attempt.answerText} truncated={attempt.answerTruncated} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {missing.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-caption font-semibold text-text-muted">Có mặt nhưng chưa nộp ({missing.length})</p>
            <p className="text-secondary text-text-default">
              {missing.map((participant) => getParticipantDisplayName(participant, participants, canViewStudents)).join(", ")}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
