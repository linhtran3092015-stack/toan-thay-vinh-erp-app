import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { getCachedCurrentAuthUser } from "@/features/auth/current-user";
import { getCareDetail } from "@/features/student-care/data";
import { CareDetailView } from "@/features/student-care/components";
export default async function StudentCareDetail({params}:{params:Promise<{taskId:string}>}) {
 const {taskId}=await params;
 if(!z.string().uuid().safeParse(taskId).success) notFound();
 const [permission,user]=await Promise.all([getCachedDatabasePermissions(),getCachedCurrentAuthUser()]);
 if(!permission.ok||!user.ok) return <ErrorState description="Không tải được quyền chăm sóc học viên."/>;
 if(!permission.permissions.includes("student_care.view")) return <PermissionDeniedState/>;
 const result=await getCareDetail(taskId);
 if(!result.ok) return <ErrorState description="Không tải được công việc chăm sóc. Vui lòng thử lại."/>;
 if(!result.data) notFound();
 return <div className="space-y-5"><Link href="/student-care" className="text-action-link underline">← Chăm sóc học viên</Link><header><h1 className="text-2xl font-semibold">{result.data.student.full_name}</h1><Link href={`/students/${result.data.student.id}`} className="text-sm text-action-link underline">Hồ sơ {result.data.student.public_code}</Link></header><CareDetailView data={result.data} userId={user.user.id} canAssign={permission.permissions.includes("student_care.assign")} canHandle={permission.permissions.includes("student_care.handle")}/></div>;
}
