import { Badge } from "@/components/ui/badge";
import { studentStatusMeta } from "@/features/students/student-filters";
import type { StudentLifecycleStatus } from "@/types/domain";

interface StudentStatusBadgeProps {
  status: StudentLifecycleStatus;
}

export function StudentStatusBadge({ status }: StudentStatusBadgeProps) {
  const meta = studentStatusMeta[status];

  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
