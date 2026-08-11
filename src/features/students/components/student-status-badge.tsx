import { Badge } from "@/components/ui/badge";
import { studentStatusMeta } from "@/features/students/student-filters";
import type { StudentLifecycleStatus } from "@/types/domain";

interface StudentStatusBadgeProps {
  status: StudentLifecycleStatus | string;
}

export function StudentStatusBadge({ status }: StudentStatusBadgeProps) {
  const meta = Object.hasOwn(studentStatusMeta, status)
    ? studentStatusMeta[status as StudentLifecycleStatus]
    : { label: `Trạng thái chưa hỗ trợ: ${status}`, tone: "neutral" as const };

  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
