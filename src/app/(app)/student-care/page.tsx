import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { CareQueueView } from "@/features/student-care/components";
import { getCareDashboard, getCareStudents } from "@/features/student-care/data";
import {
  getCareSearchParamValues,
  getCareTab,
  parseCareFilter,
  type CareRouteSearchParams,
} from "@/features/student-care/student-care-url-state";

function requestTime() {
  return Date.now();
}

export default async function StudentCarePage({ searchParams }: { searchParams: Promise<CareRouteSearchParams> }) {
  const permission = await getCachedDatabasePermissions();
  if (!permission.ok) return <ErrorState description="Không tải được quyền chăm sóc học sinh." />;
  if (!permission.permissions.includes("student_care.view")) return <PermissionDeniedState title="Không có quyền xem chăm sóc học sinh" />;

  const values = getCareSearchParamValues(await searchParams);
  const tab = getCareTab(values.tab);
  const filter = parseCareFilter(values);
  const [data, students] = await Promise.all([
    getCareDashboard(filter),
    tab === "tasks" ? Promise.resolve(null) : getCareStudents(filter.search ?? "", filter.page, tab === "inactive"),
  ]);

  return (
    <CareQueueView
      canAssign={permission.permissions.includes("student_care.assign")}
      canConfigure={permission.permissions.includes("student_care.configure")}
      canHandle={permission.permissions.includes("student_care.handle")}
      data={data}
      filter={filter}
      now={requestTime()}
      students={students}
      tab={tab}
    />
  );
}
