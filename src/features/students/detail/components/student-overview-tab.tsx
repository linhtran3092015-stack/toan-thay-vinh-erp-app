import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { StudentGuardianCard } from "./student-guardian-card";
import { StudentMainClassCard } from "./student-main-class-card";
import type { StudentDetail } from "@/features/students/detail/types";

interface StudentOverviewTabProps {
  detail: StudentDetail;
}

export function StudentOverviewTab({ detail }: StudentOverviewTabProps) {
  const { student } = detail;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.75fr]">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin học viên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoTile label="Họ tên" value={student.fullName} />
              <InfoTile label="Tên thường gọi" value={student.nickname} />
              <InfoTile label="Năm sinh" value={String(student.birthYear)} />
              <InfoTile label="Tỉnh/thành phố" value={detail.provinceName} />
              <InfoTile label="Khối hiện tại" value={`Khối ${student.currentGrade}`} />
              <InfoTile label="Mức A/B/CLC" value={student.learningLevel} />
              <InfoTile
                label="Hình thức đăng ký"
                value={student.registeredMode === "online" ? "Online" : "Offline"}
              />
              <InfoTile label="Ngày học chính thức" value={detail.officialStartDate} />
              <InfoTile label="Mục tiêu học tập" value={detail.learningGoal} wide />
              <div className="rounded-md border border-hairline bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                  Trạng thái
                </p>
                <div className="mt-2">
                  <StudentStatusBadge status={student.lifecycleStatus} />
                </div>
              </div>
              <div className="rounded-md border border-hairline bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                  Số dư buổi
                </p>
                <div className="mt-2">
                  <SessionBalanceBadge balance={student.sessionBalance} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nguồn tuyển sinh</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <InfoTile label="Nguồn" value={detail.admissionSource.sourceName} />
            <InfoTile label="Đối tác" value={detail.admissionSource.partnerName} />
            <InfoTile label="Sale chốt" value={detail.admissionSource.saleOwnerName} />
            <InfoTile label="Ngày ghi nhận" value={detail.admissionSource.recordedAt} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sổ liên lạc</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-hairline bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                Trạng thái
              </p>
              <div className="mt-2">
                <Badge tone={detail.communicationGroup.status === "created" ? "success" : "warning"}>
                  {detail.communicationGroup.status === "created"
                    ? "Đã tạo"
                    : "Chưa có"}
                </Badge>
              </div>
            </div>
            <InfoTile label="Tên nhóm" value={detail.communicationGroup.groupName} />
            <InfoTile label="Ngày tạo" value={detail.communicationGroup.createdAt} />
            <InfoTile label="Người tạo" value={detail.communicationGroup.createdBy} />
            <InfoTile label="Ghi chú" value={detail.communicationGroup.note} wide />
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <StudentGuardianCard guardian={detail.guardian} />
        <StudentMainClassCard mainClass={detail.mainClass} />
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas p-3 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  );
}
