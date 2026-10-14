import { notFound } from "next/navigation";
import { z } from "zod";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedCurrentAuthUser } from "@/features/auth/current-user";
import { CareDetailView } from "@/features/student-care/components";
import { getCareDetail } from "@/features/student-care/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function StudentCareDetail({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  if (!z.string().uuid().safeParse(taskId).success) notFound();
  const [permission, user] = await Promise.all([getCachedDatabasePermissions(), getCachedCurrentAuthUser()]);
  if (!permission.ok || !user.ok) return <ErrorState description="Không tải được quyền chăm sóc học sinh." />;
  if (!permission.permissions.includes("student_care.view")) return <PermissionDeniedState />;
  const result = await getCareDetail(taskId);
  if (!result.ok) return <ErrorState description="Không tải được công việc chăm sóc. Vui lòng thử lại." />;
  if (!result.data) notFound();

  return (
    <CareDetailView
      canAssign={permission.permissions.includes("student_care.assign")}
      canHandle={permission.permissions.includes("student_care.handle")}
      data={result.data}
      userId={user.user.id}
    />
  );
}
