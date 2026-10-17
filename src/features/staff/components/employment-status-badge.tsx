import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { StaffEmploymentStatus } from "@/features/staff/types";

/**
 * Employment status vocabulary shared by the staff list (badge and quick chips)
 * and the staff profile. The labels are pinned by tests; the design's shorter
 * "Đang làm / Nghỉ / Tạm dừng" stays unused.
 */
export const employmentStatusLabels: Record<StaffEmploymentStatus, string> = {
  active: "Đang làm việc",
  inactive: "Đã nghỉ",
  suspended: "Tạm khóa",
  unknown: "Chưa xác định",
};

const employmentStatusTones: Record<StaffEmploymentStatus, BadgeTone> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  unknown: "neutral",
};

/**
 * Server-safe (no "use client"): the server-rendered staff profile imports it
 * directly, so it does not become a client reference through the client list.
 */
export function EmploymentStatusBadge({ status }: { status: StaffEmploymentStatus }) {
  // The loader maps unexpected values to `unknown`; the guard keeps a stray
  // prototype key (e.g. "constructor") from reaching the lookup tables.
  const known: StaffEmploymentStatus = Object.hasOwn(employmentStatusLabels, status) ? status : "unknown";

  return <Badge tone={employmentStatusTones[known]}>{employmentStatusLabels[known]}</Badge>;
}
