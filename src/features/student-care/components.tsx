"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef,useState,useTransition,type ReactNode } from "react";
import { mutateCare } from "./actions";
import { careKindLabels,careStatusLabels,careRuleLabels,careTime,careIsStale,evidenceSchema,type CareCommand,type CareDashboard,type CareDetail,type CareStudents } from "./models";

const field="w-full rounded-md border border-border-subtle bg-surface-base p-2 text-sm";
const button="inline-flex min-h-10 items-center justify-center rounded-md border border-border-subtle bg-surface-base px-4 py-2 text-sm font-semibold hover:bg-interactive-hover disabled:opacity-50";
const card="rounded-lg border border-border-subtle bg-surface-base p-4 space-y-3";

export function CareActionForm({base,children,label}:{base:Omit<CareCommand,"request_id">;children?:ReactNode;label:string}) {
 const router=useRouter();const [pending,start]=useTransition();const [feedback,setFeedback]=useState<{ok:boolean;message:string}|null>(null);
 const request=useRef<{id:string;payload:string}|null>(null);
 return <form className="space-y-3" onSubmit={event=>{
  event.preventDefault();const values:Record<string,unknown>={...base};
  for(const [name,value] of new FormData(event.currentTarget)) if(typeof value==="string" && value!=="") values[name]=value;
  for(const name of ["next_followup_at","contact_at"]) if(typeof values[name]==="string") values[name]=new Date(`${values[name]}+07:00`).toISOString();
  if(typeof values.success==="string") values.success=values.success==="true";
  const payload=JSON.stringify(values);
  if(!request.current||request.current.payload!==payload) request.current={id:crypto.randomUUID(),payload};
  const input={...values,request_id:request.current.id};
  start(async()=>{try {const result=await mutateCare(input);setFeedback(result);if(result.ok){request.current=null;router.refresh();}} catch {setFeedback({ok:false,message:"Chưa xác nhận được kết quả lưu. Thử lại để kiểm tra an toàn."});}});
 }}>
  <fieldset disabled={pending} className="space-y-3">{children}<button className={button} type="submit">{pending?"Đang lưu…":label}</button></fieldset>
  {feedback?<p role={feedback.ok?"status":"alert"} className={feedback.ok?"text-sm text-text-strong":"text-sm text-danger"}>{feedback.message}</p>:null}
 </form>;
}
function Input({name,label,type="text",required=false}:{name:string;label:string;type?:string;required?:boolean}) {
 return <label className="block text-sm space-y-1"><span>{label}</span><input className={field} name={name} type={type} required={required} maxLength={4000}/></label>;
}
function Note({label="Nội dung / lý do"}:{label?:string}) {
 return <label className="block text-sm space-y-1"><span>{label}</span><textarea className={field} name="note" required maxLength={4000} rows={3}/></label>;
}
function OwnerSelect({assignees}:{assignees:CareDashboard["assignees"]}) {
 return <label className="block text-sm space-y-1"><span>Người phụ trách</span><select className={field} name="owner_id" required defaultValue=""><option value="" disabled>Chọn trợ lý</option>{assignees.map(a=><option key={a.id} value={a.id}>{a.name??"Nhân sự"}{a.open_tasks!==undefined?` · ${a.open_tasks} việc đang mở`:""}</option>)}</select></label>;
}
export function CareHealth({data}:{data:CareDashboard}) {
 const stale=careIsStale(data.settings.last_success_at);
 return <div className={card} role={data.settings.enabled&&(stale||data.queue.failed>0||data.queue.pending>0)?"alert":"status"}>
  <p className="font-semibold">{!data.settings.enabled?"Chăm sóc tự động đang tạm dừng":stale?"Bộ kiểm tra chưa cập nhật đúng hạn":data.queue.failed>0?"Một số học viên đang chờ kiểm tra lại":data.queue.pending>0?"Đang cập nhật trạng thái học viên":"Bộ kiểm tra đang hoạt động"}</p>
  <p className="text-sm text-text-muted">Lần chạy gần nhất: {careTime(data.settings.last_success_at)} · Chờ kiểm tra: {data.queue.pending} · Cần thử lại: {data.queue.failed}</p>
  {(!data.settings.enabled||stale||data.queue.failed>0||data.queue.pending>0)&&<p className="text-sm">Danh sách có thể chưa phản ánh dữ liệu mới nhất. Không có cảnh báo chưa có nghĩa tất cả học viên đều ổn.</p>}
 </div>;
}
export function CareSummary({data}:{data:CareDashboard}) {
 const s=data.summary;
 return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
  ["Cảnh báo đang mở",s.open_alerts],["Việc quá hạn",s.overdue],["Coaching tháng hoàn thành",`${s.monthly_completed}/${s.monthly_total}`],["Chưa phân công",s.unassigned],
 ].map(([title,value])=><div className={card} key={title}><p className="text-sm text-text-muted">{title}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>;
}
export function CareTaskList({data}:{data:CareDashboard}) {
 return <div className={card}><p className="text-sm">{data.total} công việc · {data.summary.monthly_on_time} Coaching đúng hạn · {data.summary.monthly_cancelled} ngoại lệ trong tháng</p>
 {data.rows.length===0?<p className="py-6 text-text-muted">Không có công việc phù hợp bộ lọc.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Học viên / công việc","Trạng thái","Phụ trách","Hạn liên hệ / theo dõi"].map(h=><th key={h} className="border-b p-3">{h}</th>)}</tr></thead><tbody>{data.rows.map(t=><tr key={t.id} className="border-b border-border-subtle">
  <td className="p-3"><Link className="font-semibold text-action-link underline" href={`/student-care/${t.id}`}>{t.full_name}</Link><p>{t.public_code} · {careKindLabels[t.kind]}</p>{t.kind==="alert"&&<p className="text-xs text-text-muted">{Object.keys(t.evidence).map(k=>careRuleLabels[k]??k).join(" · ")}</p>}</td>
  <td className="p-3">{careStatusLabels[t.status]}{t.overdue&&<p className="font-semibold text-danger">Quá hạn</p>}{!t.evidence_current&&t.kind==="alert"&&<p>Cần rà soát lại bằng chứng</p>}</td>
  <td className="p-3">{t.owner_name??"Chưa phân công"}</td><td className="p-3">{careTime(t.next_followup_at??t.contact_due_at??t.due_at)}</td>
 </tr>)}</tbody></table></div>}</div>;
}
export function CareStudentsList({data,assignees,canAssign,canHandle,inactive}:{data:CareStudents;assignees:CareDashboard["assignees"];canAssign:boolean;canHandle:boolean;inactive:boolean}) {
 return <div className="space-y-3"><p>{data.total} học viên {inactive?"theo dõi riêng":"đang học"}</p>{data.rows.map(s=><div className={card} key={s.id}>
  <div className="flex flex-wrap justify-between gap-2"><Link href={`/students/${s.id}`} className="font-semibold text-action-link underline">{s.full_name} · {s.public_code}</Link><span>{s.owner_name??"Chưa có người phụ trách"}</span></div>
  <Link className="text-sm text-action-link underline" href={`/student-care?student_id=${s.id}`}>Xem công việc và lịch sử chăm sóc</Link>
  {canAssign&&<details><summary className="cursor-pointer text-sm">Phân công phụ trách lâu dài</summary><CareActionForm base={{op:"assign_student",student_id:s.id}} label="Lưu phân công"><OwnerSelect assignees={assignees}/><Note/></CareActionForm></details>}
  {inactive&&canHandle&&<details><summary className="cursor-pointer text-sm">Tạo lịch theo dõi</summary><CareActionForm base={{op:"create_followup",student_id:s.id}} label="Tạo việc theo dõi"><Note/><Input name="next_followup_at" label="Hẹn liên hệ (giờ Việt Nam)" type="datetime-local" required/></CareActionForm></details>}
 </div>)}</div>;
}
const eventLabels:Record<string,string>={claim:"Nhận việc",contact:"Ghi nhận liên hệ",assign:"Chuyển người phụ trách",assign_student:"Phân công lâu dài",schedule:"Hẹn theo dõi",complete:"Hoàn thành",cancel:"Duyệt ngoại lệ",coaching:"Liên kết Coaching",signals_updated:"Cập nhật cảnh báo",signal_withdrawn:"Cần rà soát bằng chứng",monthly_created:"Tạo nghĩa vụ tháng",owner_unavailable:"Người phụ trách không còn đủ điều kiện",create_followup:"Tạo việc theo dõi"};
export function CareDetailView({data,canAssign,canHandle,userId}:{data:CareDetail;canAssign:boolean;canHandle:boolean;userId:string}) {
 const t=data.task;const base={task_id:t.id,student_id:t.student_id,version:t.version};
 const closed=t.status==="completed"||t.status==="cancelled";
 const canEdit=canHandle&&!closed&&(canAssign||t.owner_id===userId);
 const evidence=evidenceSchema.safeParse(t.evidence);
 return <div className="space-y-4">
  <div className={card}><p>{careKindLabels[t.kind]} · {careStatusLabels[t.status]}</p><p>Phụ trách: {data.assignees.find(a=>a.id===t.owner_id)?.name??"Chưa phân công / cần chuyển giao"}</p>
   <div className="grid gap-2 text-sm md:grid-cols-3"><p>Hạn nhận: {careTime(t.claim_due_at)}</p><p>Hạn liên hệ: {careTime(t.contact_due_at)}</p><p>Hẹn tiếp: {careTime(t.next_followup_at)}</p></div>
   {t.kind==="monthly"&&<p>Hạn hoàn thành kỳ: {careTime(t.due_at)}. Gửi form hoặc gọi không bắt máy chưa tính là hoàn thành.</p>}
   {t.outcome&&<p>Kết quả: {t.outcome}</p>}
   {!closed&&canHandle&&(t.owner_id===null||t.owner_id===userId)&&t.status==="open"&&<CareActionForm base={{...base,op:"claim"}} label="Nhận xử lý"/>}
  </div>
  {t.kind==="alert"&&<div className={card}><h2 className="font-semibold">Bằng chứng cảnh báo</h2>{!t.evidence_current&&<p role="alert">Dữ liệu hiện tại không còn đủ điều kiện. Lịch sử được giữ lại; cần rà soát trước khi kết thúc việc.</p>}
   {evidence.success?Object.entries(evidence.data).map(([rule,rows])=><div key={rule}><h3 className="font-medium">{careRuleLabels[rule]??rule}</h3><ul className="list-disc pl-5 text-sm">{rows.map(row=><li key={row.session_id}><Link href={`/sessions/${row.session_id}`} className="text-action-link underline">{row.session_date} · {row.start_time.slice(0,5)} · {row.class_name}</Link> · {rule==="low_test_streak"?`${row.test_score} điểm`:row.attendance_status==="excused_absence"?"Vắng có phép":"Vắng không phép"}</li>)}</ul></div>):<p>Không đọc được bằng chứng. Vui lòng kiểm tra dữ liệu.</p>}</div>}
  {canEdit&&<div className="grid gap-4 lg:grid-cols-2">
   <section className={card}><h2 className="font-semibold">Ghi nhận liên hệ</h2><CareActionForm key={`contact-${t.version}`} base={{...base,op:"contact"}} label="Lưu lần liên hệ">
    <label className="block text-sm">Kết quả liên hệ<select className={field} name="success" defaultValue="true"><option value="true">Đã trao đổi thực chất</option><option value="false">Chưa liên lạc được</option></select></label>
    <label className="block text-sm">Đối tượng<select className={field} name="recipient"><option value="guardian">Phụ huynh</option><option value="student">Học viên</option><option value="both">Phụ huynh và học viên</option></select></label>
    <label className="block text-sm">Kênh<select className={field} name="channel"><option value="phone">Điện thoại</option><option value="zalo">Zalo</option><option value="in_person">Trực tiếp</option><option value="other">Khác</option></select></label>
    <Input name="strengths" label="Điểm tiến bộ / điều làm tốt"/><Input name="difficulties" label="Khó khăn / tình hình hiện tại"/><Input name="plan" label="Hướng hỗ trợ đã thống nhất"/><Input name="outcome" label="Kết quả trao đổi"/><Note label="Nội dung trao đổi hoặc lần thử liên hệ"/><Input name="next_followup_at" label={t.kind==="followup"?"Hẹn tiếp (giờ Việt Nam; để trống nếu đã trao đổi và không cần theo dõi thêm)":"Ngày giờ theo dõi tiếp (giờ Việt Nam)"} type="datetime-local" required={t.kind!=="followup"}/>
   </CareActionForm></section>
   <div className="space-y-4"><section className={card}><h2 className="font-semibold">Hoàn thành công việc</h2><p className="text-sm">Chọn lần trao đổi đủ nội dung. Lịch hẹn tiếp theo được giữ thành một việc theo dõi riêng.</p><CareActionForm key={`complete-${t.version}`} base={{...base,op:"complete"}} label="Ghi nhận hoàn thành">
    <label className="block text-sm">Lần trao đổi<select className={field} name="contact_event_id" required defaultValue=""><option value="" disabled>Chọn lần trao đổi</option>{data.contacts.map(c=><option value={c.id} key={c.id}>{careTime(c.contact_at)} · {c.note.slice(0,90)}</option>)}</select></label><Note label="Kết luận hỗ trợ"/>
   </CareActionForm></section>
   <section className={card}><h2 className="font-semibold">Hẹn theo dõi / Coaching chuyên sâu</h2><details><summary className="cursor-pointer">Đổi lịch hẹn</summary><CareActionForm key={`schedule-${t.version}`} base={{...base,op:"schedule"}} label="Lưu lịch hẹn"><Note/><Input name="next_followup_at" label="Hẹn theo dõi (giờ Việt Nam)" type="datetime-local" required/></CareActionForm></details>
    <details><summary className="cursor-pointer">Tạo hoặc gắn phiếu Coaching</summary><CareActionForm key={`coaching-${t.version}`} base={{...base,op:"coaching"}} label="Lưu liên kết Coaching"><label className="block text-sm space-y-1"><span>Phiếu Coaching</span><select className={field} name="coaching_id" defaultValue=""><option value="">Tạo phiếu Coaching mới</option>{data.available_coaching.map(c=><option key={c.id} value={c.id}>{c.campaign_name}</option>)}</select></label><Note label="Lý do Coaching"/><Input name="next_followup_at" label="Ngày giờ theo dõi (giờ Việt Nam)" type="datetime-local" required/></CareActionForm></details>
   </section></div>
  </div>}
  {!closed&&canAssign&&<section className={card}><h2 className="font-semibold">Điều phối</h2><details><summary className="cursor-pointer">Chuyển người xử lý công việc này</summary><CareActionForm base={{...base,op:"assign"}} label="Chuyển người xử lý"><OwnerSelect assignees={data.assignees}/><Note/></CareActionForm></details><details><summary className="cursor-pointer">Duyệt ngoại lệ / hủy công việc</summary><CareActionForm base={{...base,op:"cancel"}} label="Ghi nhận ngoại lệ"><Note label="Lý do bắt buộc; ngoại lệ không tính là Coaching hoàn thành"/></CareActionForm></details></section>}
  {data.coaching.length>0&&<section className={card}><h2 className="font-semibold">Phiếu Coaching liên quan</h2>{data.coaching.map(c=><Link className="block text-action-link underline" key={c.id} href={`/coaching/${c.id}`}>{c.campaign_name}</Link>)}</section>}
  <section className={card}><h2 className="font-semibold">Lịch sử chăm sóc học viên</h2><p className="text-sm text-text-muted">Tối đa 200 sự kiện gần nhất; các liên hệ đủ điều kiện được chọn riêng ở phần hoàn thành.</p>{data.events.map(e=><article className="border-t border-border-subtle pt-3" key={e.id}><p className="font-medium">{eventLabels[e.event_type]??e.event_type} · {e.actor_name??"Hệ thống"}</p><p className="text-xs text-text-muted">{careTime(e.occurred_at)}</p>{["note","strengths","difficulties","plan","outcome"].map(k=>typeof e.payload[k]==="string"&&<p className="text-sm whitespace-pre-wrap" key={k}>{({note:"Nội dung",strengths:"Tiến bộ",difficulties:"Khó khăn",plan:"Hướng hỗ trợ",outcome:"Kết quả"})[k]}: {String(e.payload[k])}</p>)}{e.task_id&&e.task_id!==t.id&&<Link className="text-xs text-action-link underline" href={`/student-care/${e.task_id}`}>Xem công việc liên quan</Link>}</article>)}</section>
 </div>;
}
