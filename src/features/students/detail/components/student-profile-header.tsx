import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getInitials } from "@/features/students/detail/helpers";
import type {
  StudentDetail,
  StudentDetailAction,
} from "@/features/students/detail/types";

interface StudentProfileHeaderProps {
  detail: StudentDetail;
  isActionAllowed: (action: StudentDetailAction) => boolean;
  onMockAction: (label: string) => void;
}

const profileActions: StudentDetailAction[] = [
  { label: "Chỉnh sửa", permission: "students.update" },
  { label: "Tạo thanh toán", permission: "payments.create_request" },
  { label: "Chuyển lớp", permission: "students.transfer_class" },
  { label: "Bảo lưu", permission: "students.reserve" },
  { label: "Thêm coaching", permission: "coaching.view" },
  { label: "Khác" },
];

export function StudentProfileHeader({
  detail,
  isActionAllowed,
  onMockAction,
}: StudentProfileHeaderProps) {
  const { student } = detail;

  return (
    <section className="min-w-0 max-w-full rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
      <nav className="mb-4 flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-muted">
        <Link className="font-semibold text-primary hover:underline" href="/students">
          Học viên
        </Link>
        <span>/</span>
        <Link className="font-semibold text-primary hover:underline" href="/students">
          {student.publicCode}
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink">{student.fullName}</span>
      </nav>

      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-pill bg-primary text-xl font-bold text-white">
            {getInitials(student.fullName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink md:text-3xl">
                {student.fullName}
              </h1>
              <StudentStatusBadge status={student.lifecycleStatus} />
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Tên thường gọi: <span className="font-semibold">{student.nickname}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">Mã: {student.publicCode}</Badge>
              <Badge tone="info">Lớp chính: {student.mainClassName}</Badge>
              <Badge tone={student.learningLevel === "CLC" ? "purple" : "neutral"}>
                Mức {student.learningLevel}
              </Badge>
              <Badge tone={student.registeredMode === "online" ? "purple" : "info"}>
                {student.registeredMode === "online" ? "Online" : "Offline"}
              </Badge>
              <SessionBalanceBadge balance={student.sessionBalance} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap gap-2 xl:max-w-[520px] xl:justify-end">
          {profileActions.map((action) => {
            const isAllowed = isActionAllowed(action);

            if (action.label === "Chỉnh sửa" && isAllowed) {
              return (
                <Link
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink transition hover:border-secondary hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25",
                  )}
                  href={`/students/${student.id}/edit`}
                  key={action.label}
                >
                  {action.label}
                </Link>
              );
            }

            return (
              <Button
                className="min-h-11"
                disabled={!isAllowed}
                key={action.label}
                onClick={() => onMockAction(action.label)}
                variant={action.label === "Tạo thanh toán" ? "secondary" : "outline"}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
