import Link from "next/link";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { getCareDashboard,getCareStudents } from "@/features/student-care/data";
import { CareActionForm,CareHealth,CareSummary,CareTaskList,CareStudentsList } from "@/features/student-care/components";
import { careFilterSchema,careStatusLabels } from "@/features/student-care/models";

export default async function StudentCarePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const permission=await getCachedDatabasePermissions();
 if(!permission.ok) return <ErrorState description="Không tải được quyền chăm sóc học viên."/>;
 if(!permission.permissions.includes("student_care.view")) return <PermissionDeniedState title="Không có quyền xem chăm sóc học viên"/>;
 const raw=await searchParams;
 const params=Object.fromEntries(Object.entries(raw).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));
 const filter=careFilterSchema.parse({...params,month:params.month?`${params.month.slice(0,7)}-01`:undefined});
 const tab=params.tab;
 const [data,students]=await Promise.all([getCareDashboard(filter),tab==="assignments"||tab==="inactive"?getCareStudents(filter.search??"",filter.page,tab==="inactive"):Promise.resolve(null)]);
 if(!data||((tab==="assignments"||tab==="inactive")&&!students)) return <ErrorState title="Chưa tải được chăm sóc học viên" description="Không thể đọc dữ liệu chăm sóc. Kiểm tra kết nối và trạng thái cập nhật hệ thống; danh sách chưa được coi là trống."/>;
 const href=(page:number)=>{const q=new URLSearchParams(params);q.set("page",String(page));return `/student-care?${q}`;};
 const total=students?.total??data.total;
 return <div className="space-y-5">
  <header><h1 className="text-2xl font-semibold">Chăm sóc học viên</h1><p className="text-text-muted">Phát hiện sớm, liên hệ đúng hạn và theo sát từng học viên hằng tháng.</p></header>
  <nav className="flex flex-wrap gap-4 text-sm" aria-label="Chăm sóc học viên"><Link className="text-action-link underline" href="/student-care">Công việc</Link><Link className="text-action-link underline" href="/student-care?kind=monthly">Coaching tháng</Link><Link className="text-action-link underline" href="/student-care?tab=assignments">Phân công lâu dài</Link><Link className="text-action-link underline" href="/student-care?tab=inactive">Theo dõi riêng</Link><Link className="text-action-link underline" href="/student-care?mine=true">Việc của tôi</Link><Link className="text-action-link underline" href="/student-care?overdue=true">Quá hạn</Link></nav>
  <CareHealth data={data}/><CareSummary data={data}/>
  <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border-subtle bg-surface-base p-4" action="/student-care">
   {tab&&<input type="hidden" name="tab" value={tab}/>}{filter.student_id&&<input type="hidden" name="student_id" value={filter.student_id}/>}
   {filter.mine&&<input type="hidden" name="mine" value={filter.mine}/>}{filter.overdue&&<input type="hidden" name="overdue" value={filter.overdue}/>}
   <label className="text-sm">Tìm học viên<input className="block rounded-md border p-2" name="search" defaultValue={filter.search} maxLength={160}/></label>
   {!students&&<><label className="text-sm">Loại công việc<select className="block rounded-md border p-2" name="kind" defaultValue={filter.kind??""}><option value="">Tất cả</option><option value="alert">Cảnh báo sớm</option><option value="monthly">Coaching tháng</option><option value="followup">Theo dõi tiếp</option></select></label>
   <label className="text-sm">Tháng Coaching<input className="block rounded-md border p-2" type="month" name="month" defaultValue={data.month.slice(0,7)}/></label>
   <label className="text-sm">Trạng thái<select className="block rounded-md border p-2" name="status" defaultValue={filter.status??""}><option value="">Tất cả</option><option value="unassigned">Chưa phân công</option>{Object.entries(careStatusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}
   <button className="rounded-md border px-4 py-2 font-semibold" type="submit">Lọc</button><Link className="text-sm text-action-link underline" href="/student-care">Xóa bộ lọc</Link>
  </form>
  {students?<CareStudentsList data={students} assignees={data.assignees} canAssign={permission.permissions.includes("student_care.assign")} canHandle={permission.permissions.includes("student_care.handle")} inactive={tab==="inactive"}/>:<CareTaskList data={data}/>}
  <nav className="flex gap-4 text-sm" aria-label="Phân trang">{filter.page>1&&<Link className="text-action-link underline" href={href(filter.page-1)}>Trang trước</Link>}<span>Trang {filter.page} / {Math.max(1,Math.ceil(total/50))}</span>{filter.page*50<total&&<Link className="text-action-link underline" href={href(filter.page+1)}>Trang sau</Link>}</nav>
  {permission.permissions.includes("student_care.configure")&&<details className="rounded-lg border border-border-subtle p-4"><summary className="cursor-pointer font-semibold">Vận hành chăm sóc tự động</summary><p className="my-3 text-sm">Bật sau khi kiểm tra danh sách học viên, phân công và lịch chạy tự động. Tạm dừng giữ nguyên lịch sử và cho phép xử lý công việc đang có.</p><CareActionForm base={{op:"configure",enabled:!data.settings.enabled}} label={data.settings.enabled?"Tạm dừng tự động":"Bật chăm sóc tự động"}/></details>}
 </div>;
}
