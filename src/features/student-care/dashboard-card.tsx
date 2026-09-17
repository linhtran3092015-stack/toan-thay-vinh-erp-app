import Link from "next/link";
import { getCareDashboard } from "./data";
import { CareHealth,CareSummary } from "./components";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
export async function StudentCareDashboardCard({studentId}:{studentId?:string}) {
 const permission=await getCachedDatabasePermissions();
 if(!permission.ok||!permission.permissions.includes("student_care.view")) return null;
 const data=await getCareDashboard(studentId?{student_id:studentId}:{});
 return <section className="space-y-3 rounded-lg border border-border-subtle bg-surface-base p-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Chăm sóc học viên</h2><Link className="text-action-link underline" href={studentId?`/student-care?student_id=${studentId}`:"/student-care"}>Mở danh sách công việc</Link></div>
  {!data?<p role="alert">Chưa tải được dữ liệu chăm sóc; chưa thể kết luận có hay không có cảnh báo.</p>:studentId?<><p>{data.total} công việc được tìm thấy theo kỳ hiện tại. Chọn tháng trong danh sách để xem kỳ cũ.</p>{data.rows.slice(0,5).map(t=><Link className="block text-action-link underline" key={t.id} href={`/student-care/${t.id}`}>{t.kind==="monthly"?"Coaching tháng":t.kind==="alert"?"Cảnh báo cần hỗ trợ":"Theo dõi tiếp"} · {t.owner_name??"Chưa phân công"}</Link>)}</>:<><CareHealth data={data}/><CareSummary data={data}/></>}
 </section>;
}
